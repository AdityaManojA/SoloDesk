import { useState, useEffect, useRef } from 'react';
import Icon from './Icon.jsx';
import { finishFocus } from './productivity.js';

export function HeaderTimer({ d, mut, toast }) {
  const timer = d?.focusTimer;
  const isRunning = !!(timer && timer.startedAt);
  const [tick, setTick] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  const elapsed = timer
    ? (timer.elapsedMs || 0) + (timer.startedAt ? Math.max(0, tick - timer.startedAt) : 0)
    : 0;
  const totalSec = Math.floor(elapsed / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const formattedTime = hrs > 0
    ? `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const start = (e) => {
    e?.preventDefault();
    let title = customTitle.trim();
    let taskId = '';
    let project = '';
    if (selectedTask) {
      const t = d.tasks.find(x => x.id === selectedTask);
      if (t) {
        taskId = t.id;
        title = t.title;
        project = t.project || '';
      }
    }
    if (!title) title = 'Focus session';
    const now = Date.now();
    mut(n => {
      n.focusTimer = {
        taskId,
        title,
        project,
        startedAt: now,
        elapsedMs: 0
      };
    });
    setOpen(false);
    setCustomTitle('');
    setSelectedTask('');
    if (toast) toast(`Focus timer started for “${title}”`);
  };

  const pause = () => {
    const now = Date.now();
    mut(n => {
      if (!n.focusTimer) return;
      n.focusTimer.elapsedMs = (n.focusTimer.elapsedMs || 0) + Math.max(0, now - (n.focusTimer.startedAt || now));
      n.focusTimer.startedAt = null;
    });
  };

  const resume = () => {
    const now = Date.now();
    setTick(now);
    mut(n => {
      if (!n.focusTimer) return;
      n.focusTimer.startedAt = now;
    });
  };

  const finish = () => {
    mut(n => {
      finishFocus(n);
    });
    if (toast) toast('Focus session logged to tasks & project!');
  };

  const discard = () => {
    mut(n => {
      n.focusTimer = null;
    });
    if (toast) toast('Focus timer discarded.');
  };

  const activeTasks = (d?.tasks || []).filter(t => t.status !== 'Done' && !t.arch);

  return (
    <div className="header-timer-wrap" ref={popoverRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {!timer ? (
        <button
          type="button"
          className="ghost sm header-timer-btn"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen(!open)}
          title="Start focus timer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Icon name="focus" size={16} />
          <span>Timer</span>
        </button>
      ) : (
        <div
          className={'header-timer-pill' + (isRunning ? ' running' : ' paused')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 8px',
            borderRadius: '9999px',
            background: isRunning ? 'var(--hero-soft, #f7efe7)' : 'var(--sand-soft, #f4ede4)',
            border: '1px solid ' + (isRunning ? 'var(--hero, #c2593f)' : 'var(--sand, #c9b195)'),
            fontSize: 13,
            fontWeight: 600
          }}
        >
          <span
            className="timer-indicator"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isRunning ? 'var(--hero, #c2593f)' : 'var(--mu, #888)'
            }}
          />
          <span className="header-timer-clock" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
            {formattedTime}
          </span>
          <span
            className="header-timer-title"
            title={timer.title}
            style={{
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 500,
              color: 'var(--ink)'
            }}
          >
            {timer.title}
          </span>

          {isRunning ? (
            <button
              type="button"
              className="icon-button"
              onClick={pause}
              aria-label="Pause timer"
              title="Pause timer"
              style={{ padding: 2, minWidth: 'auto', height: 'auto', color: 'inherit' }}
            >
              <Icon name="pause" size={13} />
            </button>
          ) : (
            <button
              type="button"
              className="icon-button"
              onClick={resume}
              aria-label="Resume timer"
              title="Resume timer"
              style={{ padding: 2, minWidth: 'auto', height: 'auto', color: 'inherit' }}
            >
              <Icon name="play" size={13} />
            </button>
          )}

          <button
            type="button"
            className="btn sm"
            onClick={finish}
            title="Finish & log time"
            style={{ padding: '2px 6px', fontSize: 11, height: 'auto', lineHeight: 'normal' }}
          >
            Log
          </button>

          <button
            type="button"
            className="icon-button"
            onClick={discard}
            aria-label="Discard timer"
            title="Discard timer"
            style={{ padding: 2, minWidth: 'auto', height: 'auto', color: 'var(--mu)' }}
          >
            <Icon name="close" size={13} />
          </button>
        </div>
      )}

      {open && (
        <div
          className="card header-timer-popover"
          role="dialog"
          aria-label="Start focus timer"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 100,
            width: 280,
            padding: 14,
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            border: '1px solid var(--border)',
            background: 'var(--card, #fff)'
          }}
        >
          <h4 style={{ margin: '0 0 10px', fontSize: 14 }}>Start focus timer</h4>
          <form onSubmit={start} style={{ display: 'grid', gap: 10 }}>
            {activeTasks.length > 0 && (
              <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                <span>Select an open task:</span>
                <select
                  value={selectedTask}
                  onChange={(e) => {
                    setSelectedTask(e.target.value);
                    if (e.target.value) setCustomTitle('');
                  }}
                  style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}
                >
                  <option value="">— Choose a task —</option>
                  {activeTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {!selectedTask && (
              <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                <span>Or type custom focus:</span>
                <input
                  type="text"
                  placeholder="e.g. Design review, Client call"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  maxLength={100}
                  style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}
                  autoFocus
                />
              </label>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 4, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="ghost sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn sm"
                disabled={!selectedTask && !customTitle.trim()}
              >
                Start
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
export default HeaderTimer;
