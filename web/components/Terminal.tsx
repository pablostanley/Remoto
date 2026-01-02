'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

// Common keyboard shortcuts for terminal
const KEYBOARD_SHORTCUTS = [
  { key: 'Esc', code: '\x1b', desc: 'Cancel / Exit' },
  { key: 'Ctrl+C', code: '\x03', desc: 'Interrupt process' },
  { key: 'Ctrl+D', code: '\x04', desc: 'End of input / Logout' },
  { key: 'Ctrl+Z', code: '\x1a', desc: 'Suspend process' },
  { key: 'Ctrl+L', code: '\x0c', desc: 'Clear screen' },
  { key: 'Tab', code: '\t', desc: 'Autocomplete' },
  { key: 'Ctrl+A', code: '\x01', desc: 'Move to line start' },
  { key: 'Ctrl+E', code: '\x05', desc: 'Move to line end' },
  { key: 'Ctrl+U', code: '\x15', desc: 'Clear line before cursor' },
  { key: 'Ctrl+K', code: '\x0b', desc: 'Clear line after cursor' },
  { key: 'Ctrl+W', code: '\x17', desc: 'Delete word before cursor' },
  { key: 'Ctrl+R', code: '\x12', desc: 'Search command history' },
  { key: 'Yes', code: 'y\r', desc: 'Confirm (y + Enter)', delay: true },
  { key: 'No', code: 'n\r', desc: 'Decline (n + Enter)', delay: true },
];

// Claude Code slash commands
const CLAUDE_COMMANDS = [
  { cmd: '/help', desc: 'Show all commands' },
  { cmd: '/clear', desc: 'Clear conversation history' },
  { cmd: '/compact', desc: 'Toggle compact mode' },
  { cmd: '/config', desc: 'View/edit configuration' },
  { cmd: '/cost', desc: 'Show token usage & cost' },
  { cmd: '/doctor', desc: 'Run diagnostics' },
  { cmd: '/init', desc: 'Initialize project with CLAUDE.md' },
  { cmd: '/memory', desc: 'Edit CLAUDE.md memory' },
  { cmd: '/model', desc: 'Switch AI model' },
  { cmd: '/permissions', desc: 'View/edit permissions' },
  { cmd: '/pr', desc: 'Create a pull request' },
  { cmd: '/review', desc: 'Request code review' },
  { cmd: '/vim', desc: 'Toggle vim mode' },
  { cmd: '/logout', desc: 'Sign out' },
  { cmd: '/bug', desc: 'Report a bug' },
];

interface TerminalProps {
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  onReady?: (write: (data: string) => void) => void;
}

export default function Terminal({ onData, onResize, onReady }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [isClaudeCode, setIsClaudeCode] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const [showKeyboardDrawer, setShowKeyboardDrawer] = useState(false);
  const outputBufferRef = useRef('');

  // Send keyboard shortcut
  const sendShortcut = (shortcut: typeof KEYBOARD_SHORTCUTS[0]) => {
    if (shortcut.delay) {
      // For Yes/No, send character first then Enter
      onData(shortcut.code[0]);
      setTimeout(() => onData('\r'), 100);
    } else {
      onData(shortcut.code);
    }
    setShowKeyboardDrawer(false);
  };

  // Load recent commands from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('remoto-recent-commands');
    if (stored) {
      setRecentCommands(JSON.parse(stored));
    }
  }, []);

  // Save command to recent
  const saveRecentCommand = (cmd: string) => {
    if (!cmd.startsWith('/')) return;
    const updated = [cmd, ...recentCommands.filter(c => c !== cmd)].slice(0, 10);
    setRecentCommands(updated);
    localStorage.setItem('remoto-recent-commands', JSON.stringify(updated));
  };

  // Expose write function to parent and detect Claude Code
  const write = useCallback((data: string) => {
    xtermRef.current?.write(data);

    // Buffer output to detect Claude Code
    outputBufferRef.current += data;
    // Keep only last 2000 chars
    if (outputBufferRef.current.length > 2000) {
      outputBufferRef.current = outputBufferRef.current.slice(-2000);
    }

    // Detect Claude Code by looking for its signature patterns
    if (outputBufferRef.current.includes('Claude Code') ||
        outputBufferRef.current.includes('claude-code') ||
        outputBufferRef.current.includes('Opus 4') ||
        outputBufferRef.current.includes('Sonnet 4')) {
      setIsClaudeCode(true);
    }
  }, []);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    // Create terminal instance
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#ededed',
        cursor: '#ededed',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#444',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bbbbbb',
        brightBlack: '#555555',
        brightRed: '#ff5555',
        brightGreen: '#50fa7b',
        brightYellow: '#f1fa8c',
        brightBlue: '#bd93f9',
        brightMagenta: '#ff79c6',
        brightCyan: '#8be9fd',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    xterm.open(terminalRef.current);
    fitAddon.fit();

    // Handle user input
    xterm.onData((data) => {
      onData(data);
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      onResize(xterm.cols, xterm.rows);
    };

    window.addEventListener('resize', handleResize);

    // Initial resize notification
    setTimeout(() => {
      fitAddon.fit();
      onResize(xterm.cols, xterm.rows);
    }, 100);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Notify parent that terminal is ready
    if (onReady) {
      onReady(write);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [onData, onResize, onReady, write]);

  // Actually SEND to terminal
  const handleSend = () => {
    if (!inputValue.trim()) return;

    // Replace any newlines in the input with spaces (flatten to single line)
    const text = inputValue.replace(/\n/g, ' ').trim();

    // Save slash commands to recent
    if (text.startsWith('/')) {
      saveRecentCommand(text.split(' ')[0]);
    }

    // Send text first
    onData(text);

    // Then send Enter key separately after a delay
    // This prevents "paste mode" detection where Enter becomes a newline
    setTimeout(() => {
      onData('\r');
    }, 100);

    setInputValue('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  // Insert command from palette
  const insertCommand = (cmd: string) => {
    setInputValue(cmd + ' ');
    setShowCommandPalette(false);
    setCommandSearch('');
    inputRef.current?.focus();
  };

  // Filter commands based on search
  const filteredCommands = commandSearch
    ? CLAUDE_COMMANDS.filter(c =>
        c.cmd.toLowerCase().includes(commandSearch.toLowerCase()) ||
        c.desc.toLowerCase().includes(commandSearch.toLowerCase())
      )
    : CLAUDE_COMMANDS;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // iOS keyboard Return = line break (for multi-line messages to Claude)
    // Only our Send button actually submits

    // Handle special terminal keys
    if (e.key === 'Tab') {
      e.preventDefault();
      onData('\t');
    } else if (e.key === 'Escape') {
      onData('\x1b');
    } else if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      onData('\x03');
      setInputValue('');
    } else if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      onData('\x04');
    } else if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      onData('\x1a');
    } else if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      onData('\x0c');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Terminal output area */}
      <div
        ref={terminalRef}
        className="flex-1 min-h-0 overflow-auto"
        onClick={() => inputRef.current?.focus()}
      />

      {/* Command Palette Modal */}
      {showCommandPalette && (
        <div className="absolute inset-0 bg-black/80 z-50 flex flex-col">
          <div className="flex-1 flex flex-col max-h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-white font-medium">Commands</h2>
              <button
                onClick={() => { setShowCommandPalette(false); setCommandSearch(''); }}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-gray-800">
              <input
                type="text"
                value={commandSearch}
                onChange={(e) => setCommandSearch(e.target.value)}
                placeholder="Search commands..."
                autoFocus
                className="w-full bg-gray-900 text-white px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Recent commands */}
            {!commandSearch && recentCommands.length > 0 && (
              <div className="p-3 border-b border-gray-800">
                <p className="text-xs text-gray-500 uppercase mb-2">Recent</p>
                <div className="flex flex-wrap gap-2">
                  {recentCommands.map((cmd) => (
                    <button
                      key={cmd}
                      onClick={() => insertCommand(cmd)}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-sm text-white"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Command list */}
            <div className="flex-1 overflow-y-auto p-2">
              {filteredCommands.map((c) => (
                <button
                  key={c.cmd}
                  onClick={() => insertCommand(c.cmd)}
                  className="w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-800 rounded-lg text-left"
                >
                  <span className="text-blue-400 font-mono text-sm">{c.cmd}</span>
                  <span className="text-gray-400 text-sm">{c.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick actions bar */}
      <div className="shrink-0 bg-[#111] border-t border-gray-800 px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Commands button - highlighted when in Claude Code */}
          <button
            type="button"
            onClick={() => setShowCommandPalette(true)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              isClaudeCode
                ? 'bg-purple-600 hover:bg-purple-500 text-white'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}
          >
            /
          </button>
          <div className="w-px h-6 bg-gray-700" />
          {/* Arrow navigation for option selection */}
          <button
            type="button"
            onClick={() => onData('\x1b[A')}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-white text-sm"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onData('\x1b[B')}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-white text-sm"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => onData('\r')}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-white text-sm"
          >
            Return
          </button>
          <div className="flex-1" />
          {/* Keyboard shortcuts drawer */}
          <Drawer open={showKeyboardDrawer} onOpenChange={setShowKeyboardDrawer}>
            <DrawerTrigger asChild>
              <button
                type="button"
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 text-sm"
              >
                •••
              </button>
            </DrawerTrigger>
            <DrawerContent className="bg-[#111] border-gray-800">
              <DrawerHeader>
                <DrawerTitle className="text-white">Keyboard Shortcuts</DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-8 max-h-[60vh] overflow-y-auto">
                <div className="grid gap-2">
                  {KEYBOARD_SHORTCUTS.map((shortcut) => (
                    <button
                      key={shortcut.key}
                      onClick={() => sendShortcut(shortcut)}
                      className="flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800 rounded-lg text-left"
                    >
                      <span className="text-gray-400 text-sm">{shortcut.desc}</span>
                      <span className="text-white font-mono text-sm bg-gray-800 px-2 py-1 rounded">
                        {shortcut.key}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>

      {/* Text input bar */}
      <div className="shrink-0 bg-[#0a0a0a] border-t border-gray-800 safe-area-bottom">
        <div className="flex items-end gap-2 p-3">
          <span className="text-green-500 font-mono text-sm pb-2">$</span>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="type command..."
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="done"
            data-form-type="other"
            data-lpignore="true"
            rows={1}
            className="flex-1 bg-transparent text-white font-mono text-sm focus:outline-none placeholder:text-gray-600 resize-none min-h-[24px] max-h-[120px]"
            style={{ height: 'auto', overflow: 'hidden' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          <button
            type="button"
            onClick={() => { onData('\x03'); setInputValue(''); }}
            className="px-2 py-1 text-red-500 text-xs font-mono font-bold"
          >
            ^C
          </button>
          <button
            type="button"
            onClick={handleSend}
            className="px-3 py-1 bg-white text-black rounded text-sm font-medium"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// Export a way to imperatively write to terminal
export function useTerminalRef() {
  const ref = useRef<{ write: (data: string) => void } | null>(null);
  return ref;
}
