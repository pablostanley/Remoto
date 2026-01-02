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
} from '@/components/ui/drawer';

// Quick actions (shown in drawer)
const QUICK_ACTIONS = [
  { key: '↑', code: '\x1b[A', desc: 'Navigate up', category: 'navigation' },
  { key: '↓', code: '\x1b[B', desc: 'Navigate down', category: 'navigation' },
  { key: '←', code: '\x1b[D', desc: 'Move cursor left', category: 'navigation' },
  { key: '→', code: '\x1b[C', desc: 'Move cursor right', category: 'navigation' },
  { key: 'Return', code: '\r', desc: 'Confirm / Submit', category: 'navigation' },
  { key: 'Tab', code: '\t', desc: 'Autocomplete', category: 'navigation' },
];

// Keyboard shortcuts
const KEYBOARD_SHORTCUTS = [
  { key: 'Esc', code: '\x1b', desc: 'Cancel / Exit', category: 'control' },
  { key: 'Ctrl+C', code: '\x03', desc: 'Interrupt process', category: 'control' },
  { key: 'Ctrl+D', code: '\x04', desc: 'End of input / Logout', category: 'control' },
  { key: 'Ctrl+Z', code: '\x1a', desc: 'Suspend process', category: 'control' },
  { key: 'Ctrl+L', code: '\x0c', desc: 'Clear screen', category: 'control' },
  { key: 'Ctrl+A', code: '\x01', desc: 'Move to line start', category: 'editing' },
  { key: 'Ctrl+E', code: '\x05', desc: 'Move to line end', category: 'editing' },
  { key: 'Ctrl+U', code: '\x15', desc: 'Clear line before cursor', category: 'editing' },
  { key: 'Ctrl+K', code: '\x0b', desc: 'Clear line after cursor', category: 'editing' },
  { key: 'Ctrl+W', code: '\x17', desc: 'Delete word before cursor', category: 'editing' },
  { key: 'Ctrl+R', code: '\x12', desc: 'Search command history', category: 'editing' },
];

// Yes/No quick responses
const YES_NO_ACTIONS = [
  { key: 'Yes', code: 'y', desc: 'Confirm (y + Enter)', category: 'response' },
  { key: 'No', code: 'n', desc: 'Decline (n + Enter)', category: 'response' },
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

  // Detection states
  const [isClaudeCode, setIsClaudeCode] = useState(false);
  const [hasYesNoPrompt, setHasYesNoPrompt] = useState(false);

  // UI states
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [recentCommands, setRecentCommands] = useState<string[]>([]);

  const outputBufferRef = useRef('');

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

  // Send a shortcut/action
  const sendAction = (code: string, isYesNo = false) => {
    if (isYesNo) {
      onData(code);
      setTimeout(() => onData('\r'), 100);
    } else {
      onData(code);
    }
    setShowDrawer(false);
    setDrawerSearch('');
  };

  // Insert command into input
  const insertCommand = (cmd: string) => {
    setInputValue(cmd + ' ');
    setShowDrawer(false);
    setDrawerSearch('');
    inputRef.current?.focus();
  };

  // Detect patterns in terminal output
  const detectPatterns = useCallback((buffer: string) => {
    // Get last ~500 chars for recent context
    const recentOutput = buffer.slice(-500);

    // Detect Claude Code (for showing Claude commands in drawer)
    const claudePatterns = ['Claude Code', 'claude-code', 'Opus 4', 'Sonnet 4', 'Haiku'];
    const isClaudeDetected = claudePatterns.some(p => buffer.includes(p));
    setIsClaudeCode(isClaudeDetected);

    // Detect yes/no prompts
    const yesNoPatterns = [
      /\[y\/n\]/i,
      /\(y\/n\)/i,
      /\(yes\/no\)/i,
      /\[Y\/n\]/,
      /\[y\/N\]/,
      /continue\?/i,
      /proceed\?/i,
      /confirm\?/i,
    ];
    const hasYesNo = yesNoPatterns.some(p => p.test(recentOutput));
    setHasYesNoPrompt(hasYesNo);
  }, []);

  // Expose write function to parent and detect patterns
  const write = useCallback((data: string) => {
    xtermRef.current?.write(data);

    // Buffer output for pattern detection
    outputBufferRef.current += data;
    if (outputBufferRef.current.length > 3000) {
      outputBufferRef.current = outputBufferRef.current.slice(-3000);
    }

    detectPatterns(outputBufferRef.current);
  }, [detectPatterns]);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

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

    xterm.onData((data) => {
      onData(data);
    });

    const handleResize = () => {
      fitAddon.fit();
      onResize(xterm.cols, xterm.rows);
    };

    window.addEventListener('resize', handleResize);

    setTimeout(() => {
      fitAddon.fit();
      onResize(xterm.cols, xterm.rows);
    }, 100);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    if (onReady) {
      onReady(write);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [onData, onResize, onReady, write]);

  // Send message or just Return if empty
  const handleSend = () => {
    const text = inputValue.replace(/\n/g, ' ').trim();

    if (text) {
      // Save slash commands to recent
      if (text.startsWith('/')) {
        saveRecentCommand(text.split(' ')[0]);
      }
      // Send text first, then Return
      onData(text);
      setTimeout(() => onData('\r'), 100);
    } else {
      // No text - just send Return (for confirming selections)
      onData('\r');
    }

    setInputValue('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

      {/* Yes/No bar - only shows when y/n prompt detected */}
      {hasYesNoPrompt && (
        <div className="shrink-0 bg-[#0a0a0a] px-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => sendAction('y', true)}
              className="h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 active:scale-95 transition-transform rounded-full text-sm font-medium"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => sendAction('n', true)}
              className="h-10 px-5 bg-secondary hover:bg-secondary/80 active:bg-secondary/60 active:scale-95 transition-transform rounded-full text-foreground text-sm font-medium"
            >
              No
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 bg-[#0a0a0a] safe-area-bottom">
        <div className="flex items-center gap-2 p-3">
          {/* Plus button - opens unified drawer */}
          <button
            type="button"
            onClick={() => {
              inputRef.current?.blur();
              setShowDrawer(true);
            }}
            className="w-10 h-10 flex items-center justify-center bg-secondary hover:bg-secondary/80 active:bg-secondary/60 active:scale-95 transition-transform rounded-full text-muted-foreground text-xl shrink-0"
          >
            +
          </button>

          {/* Arrow keys - always visible for navigation */}
          <button
            type="button"
            onClick={() => onData('\x1b[A')}
            className="w-10 h-10 flex items-center justify-center bg-secondary hover:bg-secondary/80 active:bg-secondary/60 active:scale-95 transition-transform rounded-full text-foreground text-base shrink-0"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onData('\x1b[B')}
            className="w-10 h-10 flex items-center justify-center bg-secondary hover:bg-secondary/80 active:bg-secondary/60 active:scale-95 transition-transform rounded-full text-foreground text-base shrink-0"
          >
            ↓
          </button>

          {/* Text input - not in a form to avoid password/payment autocomplete */}
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              } else {
                handleKeyDown(e);
              }
            }}
            placeholder="Type a message..."
            autoCapitalize="sentences"
            autoCorrect="on"
            spellCheck={true}
            inputMode="text"
            enterKeyHint="send"
            rows={1}
            className="flex-1 bg-card text-foreground text-base px-4 py-3 rounded-2xl border border-border focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none min-h-[48px] max-h-[120px]"
            style={{ overflow: 'hidden' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:bg-primary/90 active:bg-primary/80 active:scale-95 transition-transform shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Unified drawer */}
      <Drawer open={showDrawer} onOpenChange={setShowDrawer}>
        <DrawerContent className="bg-background border-border max-h-[85vh]">
          <DrawerHeader className="border-b border-border pb-0">
            <DrawerTitle className="text-foreground sr-only">Actions & Commands</DrawerTitle>
            {/* Search input */}
            <input
              type="text"
              value={drawerSearch}
              onChange={(e) => setDrawerSearch(e.target.value)}
              placeholder="Search actions..."
              className="w-full bg-card text-foreground text-base px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground mb-4"
            />
          </DrawerHeader>

          <div className="overflow-y-auto px-4 pb-8">
            {/* Recent commands */}
            {!drawerSearch && recentCommands.length > 0 && (
              <div className="mb-6">
                <p className="text-xs text-muted-foreground uppercase mb-2 px-1">Recent</p>
                <div className="flex flex-wrap gap-2">
                  {recentCommands.map((cmd) => (
                    <button
                      key={cmd}
                      onClick={() => insertCommand(cmd)}
                      className="px-3 py-2 bg-secondary hover:bg-secondary/80 active:bg-secondary/60 rounded-full text-sm text-foreground"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick actions */}
            {QUICK_ACTIONS.filter(a => !drawerSearch || a.key.toLowerCase().includes(drawerSearch.toLowerCase()) || a.desc.toLowerCase().includes(drawerSearch.toLowerCase())).length > 0 && (
              <div className="mb-6">
                <p className="text-xs text-muted-foreground uppercase mb-2 px-1">Navigation</p>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_ACTIONS.filter(a => !drawerSearch || a.key.toLowerCase().includes(drawerSearch.toLowerCase()) || a.desc.toLowerCase().includes(drawerSearch.toLowerCase())).map((action) => (
                    <button
                      key={action.key}
                      onClick={() => sendAction(action.code)}
                      className="flex flex-col items-center gap-1 px-3 py-3 bg-card hover:bg-card/80 active:bg-card/60 border border-border rounded-xl"
                    >
                      <span className="text-foreground text-lg">{action.key}</span>
                      <span className="text-muted-foreground text-xs">{action.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Yes/No */}
            {YES_NO_ACTIONS.filter(a => !drawerSearch || a.key.toLowerCase().includes(drawerSearch.toLowerCase()) || a.desc.toLowerCase().includes(drawerSearch.toLowerCase())).length > 0 && (
              <div className="mb-6">
                <p className="text-xs text-muted-foreground uppercase mb-2 px-1">Quick Responses</p>
                <div className="grid grid-cols-2 gap-2">
                  {YES_NO_ACTIONS.filter(a => !drawerSearch || a.key.toLowerCase().includes(drawerSearch.toLowerCase()) || a.desc.toLowerCase().includes(drawerSearch.toLowerCase())).map((action) => (
                    <button
                      key={action.key}
                      onClick={() => sendAction(action.code, true)}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-card hover:bg-card/80 active:bg-card/60 border border-border rounded-xl"
                    >
                      <span className="text-foreground font-medium">{action.key}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Claude commands - only when detected */}
            {isClaudeCode && CLAUDE_COMMANDS.filter(c => !drawerSearch || c.cmd.toLowerCase().includes(drawerSearch.toLowerCase()) || c.desc.toLowerCase().includes(drawerSearch.toLowerCase())).length > 0 && (
              <div className="mb-6">
                <p className="text-xs text-muted-foreground uppercase mb-2 px-1">Claude Commands</p>
                <div className="space-y-1">
                  {CLAUDE_COMMANDS.filter(c => !drawerSearch || c.cmd.toLowerCase().includes(drawerSearch.toLowerCase()) || c.desc.toLowerCase().includes(drawerSearch.toLowerCase())).map((cmd) => (
                    <button
                      key={cmd.cmd}
                      onClick={() => insertCommand(cmd.cmd)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-card/80 active:bg-card/60 border border-border rounded-xl text-left"
                    >
                      <span className="text-foreground font-mono text-sm">{cmd.cmd}</span>
                      <span className="text-muted-foreground text-sm">{cmd.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Keyboard shortcuts */}
            {KEYBOARD_SHORTCUTS.filter(s => !drawerSearch || s.key.toLowerCase().includes(drawerSearch.toLowerCase()) || s.desc.toLowerCase().includes(drawerSearch.toLowerCase())).length > 0 && (
              <div className="mb-6">
                <p className="text-xs text-muted-foreground uppercase mb-2 px-1">Keyboard Shortcuts</p>
                <div className="space-y-1">
                  {KEYBOARD_SHORTCUTS.filter(s => !drawerSearch || s.key.toLowerCase().includes(drawerSearch.toLowerCase()) || s.desc.toLowerCase().includes(drawerSearch.toLowerCase())).map((shortcut) => (
                    <button
                      key={shortcut.key}
                      onClick={() => sendAction(shortcut.code)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-card/80 active:bg-card/60 border border-border rounded-xl"
                    >
                      <span className="text-muted-foreground text-sm">{shortcut.desc}</span>
                      <span className="text-foreground font-mono text-sm bg-secondary px-2 py-1 rounded">
                        {shortcut.key}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

// Export a way to imperatively write to terminal
export function useTerminalRef() {
  const ref = useRef<{ write: (data: string) => void } | null>(null);
  return ref;
}
