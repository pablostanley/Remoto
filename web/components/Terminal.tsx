'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
}

export default function Terminal({ onData, onResize }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

    // Expose write method on the DOM element for parent access
    (terminalRef.current as any).terminalWrite = write;

    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [onData, onResize, write]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue) {
      onData(inputValue + '\r');
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle special keys
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
    <div className="flex flex-col h-full">
      <div
        ref={terminalRef}
        className="flex-1 overflow-hidden"
        onClick={() => inputRef.current?.focus()}
      />
      {/* Mobile input bar */}
      <form onSubmit={handleSubmit} className="flex gap-2 p-2 bg-[#1a1a1a] border-t border-gray-800">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type command..."
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 bg-[#0a0a0a] border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-gray-500"
        />
        <button
          type="button"
          onClick={() => { onData('\x03'); setInputValue(''); }}
          className="px-3 py-2 bg-red-900/50 text-red-400 rounded text-sm font-mono hover:bg-red-900/70"
        >
          ^C
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
        >
          Run
        </button>
      </form>
    </div>
  );
}

// Export a way to imperatively write to terminal
export function useTerminalRef() {
  const ref = useRef<{ write: (data: string) => void } | null>(null);
  return ref;
}
