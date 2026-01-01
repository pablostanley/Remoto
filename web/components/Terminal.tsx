'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

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

  // Expose write function to parent
  const write = useCallback((data: string) => {
    xtermRef.current?.write(data);
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

  // Actually SEND to terminal (Return key behavior)
  const handleSend = () => {
    if (!inputValue.trim()) return;
    // Send the text + carriage return (actual submit)
    onData(inputValue + '\r');
    setInputValue('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter key = line break in textarea (for multi-line input)
    // Don't prevent default - let it add newlines naturally
    // User presses Send button to actually submit

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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Terminal output area */}
      <div
        ref={terminalRef}
        className="flex-1 min-h-0 overflow-auto"
        onClick={() => inputRef.current?.focus()}
      />
      {/* Fixed input bar at bottom */}
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
