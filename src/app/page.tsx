"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowRight, Check, ChevronDown, Clipboard, Clock3, Command,
  Mail, MapPin, RotateCcw, Sparkles, Users, Video, X, Zap, AlertTriangle,
  Calendar, Link2, Info, RefreshCw, ChevronRight, Star
} from "lucide-react";
import { Agenda, AiStatus, Constraints, InviteDraft, Slot } from "@/types/scheduling";
import { MeetingRecord } from "@/types/history";
import { attendees as calendarAttendees, calendar, team } from "@/data/mockCalendarData";
import { generateInviteText } from "@/lib/googleMeet";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { ClarificationState } from "@/lib/clarification";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "input" | "review" | "results" | "invite";
type WorkspaceView = "schedule" | "meetings" | "calendars";
type ConflictExplanation = { tradeoffExplanation: string; suggestedResolution: string; aiStatus?: "ai" | "fallback" };
type ParseResponse = { constraints?: Constraints; aiStatus?: "ai" | "fallback"; needsClarification?: boolean; clarification?: string; clarificationState?: ClarificationState; error?: string };

const LOADING_MESSAGES = [
  "Understanding your meeting request…",
  "Parsing constraints and attendees…",
  "Checking attendee availability…",
  "Finding your best time slots…",
  "Analysing conflicts and trade-offs…",
  "Generating your meeting agenda…",
  "Preparing your invite…",
];

const SAMPLES = [
  "I need a 45-minute Q4 design review with Alice, Bob, Carol and Dave next week. Prefer afternoons and avoid Friday.",
  "Schedule a 15-minute API sync with Dave on Tuesday afternoon.",
  "I need a 1-hour brainstorming session with Alice, Bob and Carol next week. Prefer mornings but no Monday.",
  "Schedule a 30-minute meeting with Alice in Conference Room B tomorrow.",
];

// ─── Utilities ────────────────────────────────────────────────────────────────
function AiStatusBadge({ status, label }: { status: "ai" | "fallback"; label: string }) {
  if (status === "ai") return (
    <span className="ai-badge ai-badge--active" title="OpenAI generated this">
      <Sparkles size={11} /> {label}
    </span>
  );
  return (
    <span className="ai-badge ai-badge--fallback" title="Deterministic fallback used">
      <Info size={11} /> {label} (fallback)
    </span>
  );
}

// ─── Google Status Panel ───────────────────────────────────────────────────────
function GoogleStatusPanel({ invite, onConnect }: { invite: InviteDraft | null; onConnect: () => void }) {
  if (!invite) return null;
  const { googleStatus, googleError, meetLink, googleEventUrl } = invite;

  if (googleStatus === "created" && meetLink) {
    return (
      <div className="google-panel google-panel--success">
        <div className="google-panel__header">
          <Check size={15} className="google-panel__icon" />
          <div>
            <strong>Google Calendar Event Created</strong>
            <span>Real Google Meet link generated</span>
          </div>
        </div>
        <div className="google-panel__actions">
          <a href={meetLink} target="_blank" rel="noreferrer" className="meet-launch-btn">
            <Video size={15} /> Open Google Meet
          </a>
          {googleEventUrl && (
            <a href={googleEventUrl} target="_blank" rel="noreferrer" className="gcal-btn">
              <Calendar size={15} /> View in Calendar
            </a>
          )}
        </div>
        {meetLink && <code className="meet-link-code">{meetLink}</code>}
      </div>
    );
  }

  if (googleStatus === "failed") {
    return (
      <div className="google-panel google-panel--error">
        <div className="google-panel__header">
          <AlertTriangle size={15} className="google-panel__icon" />
          <div>
            <strong>Google Calendar Event Creation Failed</strong>
            <span>{googleError || "An error occurred. Check OAuth permissions."}</span>
          </div>
        </div>
        <p className="google-panel__note">Your invite is ready as a draft below.</p>
      </div>
    );
  }

  if (googleStatus === "demo") {
    return (
      <div className="google-panel google-panel--demo">
        <div className="google-panel__header">
          <Info size={15} className="google-panel__icon" />
          <div>
            <strong>Demo Mode</strong>
            <span>This is a simulated Meet link, not a real Google Meet room.</span>
          </div>
        </div>
      </div>
    );
  }

  if (googleStatus === "not_connected") return null;
  return (
    <div className="google-panel google-panel--disconnected">
      <div className="google-panel__header">
        <Link2 size={15} className="google-panel__icon" />
        <div>
          <strong>Google Calendar Not Connected</strong>
          <span>Connect to create a real Google Calendar event and Meet room.</span>
        </div>
      </div>
      <button className="google-connect-btn" onClick={onConnect}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Connect Google Calendar
      </button>
    </div>
  );
}

// ─── Conflict Panel ────────────────────────────────────────────────────────────
function ConflictPanel({ slot, constraints, onClose }: { slot: Slot; constraints: Constraints; onClose: () => void }) {
  const [explanation, setExplanation] = useState<ConflictExplanation | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(() => Boolean(slot.conflicts.length));
  const [inviteCopied, setInviteCopied] = useState(false);

  useEffect(() => {
    if (!slot.conflicts.length) return;
    fetch("/api/explain-conflict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot, constraints }),
    })
      .then((r) => r.json())
      .then(setExplanation)
      .catch(() => setExplanation(null))
      .finally(() => setLoadingExplanation(false));
  }, [slot, constraints]);

  async function copyFormattedInvite() {
    const inviteText = generateInviteText(
      constraints.meetingPurpose,
      slot.date,
      slot.start,
      slot.end,
      constraints.attendees,
      ["Opening and objectives", constraints.meetingPurpose, "Decisions and next steps"],
    );
    try {
      await navigator.clipboard.writeText(inviteText);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 3000);
    } catch {
      setInviteCopied(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Conflict details for ${slot.label}`}>
      <aside className="conflict-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose} aria-label="Close conflict panel"><X size={18} /></button>
        <div className="section-kicker">SLOT EXPLANATION</div>
        <h3>{slot.label}</h3>
        <div className={`severity ${slot.severity}`}>{slot.severity} severity</div>
        <div className="panel-score">
          <strong>{slot.fitScore}%</strong><span>fit score</span>
        </div>
        <p className="panel-copy">
          {slot.conflicts.length
            ? `This window works for ${slot.available.length} of ${slot.available.length + slot.conflicts.length} attendees. ${slot.conflicts.map((c) => `${c.attendee}`).join(" and ")} ${slot.conflicts.length > 1 ? "have conflicts" : "has a conflict"}.`
            : "Everyone is available during this window and it matches your scheduling preferences."}
        </p>
        <div className="panel-facts">
          <div><span>AVAILABLE</span><strong>{slot.available.length}/{constraints.attendees.length} attendees</strong></div>
          <div><span>PREFERENCE FIT</span><strong>{slot.preferenceScore >= 20 ? "Preferred time" : "Acceptable time"}</strong></div>
          <div><span>FAIRNESS</span><strong>{slot.fairness}</strong></div>
        </div>
        {slot.conflicts.map((conflict) => {
          const member = team.find(m => m.name === conflict.attendee);
          return (
            <div className="conflict-detail" key={conflict.attendee}>
              <span className="chip-avatar">{conflict.attendee[0]}</span>
              <div>
                <strong>{conflict.attendee}</strong>
                {member && <em className="conflict-role">{member.role}</em>}
                <p>{conflict.event.title} · {conflict.event.start}–{conflict.event.end}</p>
              </div>
              <span className="duration-pill">{conflict.duration}m overlap</span>
            </div>
          );
        })}

        {loadingExplanation && <div className="panel-loading"><RefreshCw size={14} className="spin" /> Generating explanation…</div>}
        {explanation && (
          <div className="ai-explanation">
            <div className="ai-explanation__header">
              <Sparkles size={14} />
              <span>Trade-off Analysis</span>
              {explanation.aiStatus && <AiStatusBadge status={explanation.aiStatus} label="Explanation" />}
            </div>
            <p className="ai-explanation__text">{explanation.tradeoffExplanation}</p>
            {explanation.suggestedResolution && (
              <div className="resolution">
                <Sparkles size={15} />
                <div>
                  <strong>Suggested resolution</strong>
                  <p>{explanation.suggestedResolution}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Conflict negotiation actions */}
        {slot.conflicts.length > 0 && (
          <div className="conflict-actions">
            <div className="mini-label">NEGOTIATION OPTIONS (DEMO)</div>
            <button className="conflict-action-btn" onClick={() => alert("Demo: Would notify attendees to reschedule their conflicting event.")}>
              <RefreshCw size={13} /> Move conflicting event
            </button>
            <button className="conflict-action-btn" onClick={() => alert(`Demo: Would invite only ${slot.available.join(", ")} and skip conflicted attendees.`)}>
              <Users size={13} /> Invite available attendees only
            </button>
            <button className="conflict-action-btn" onClick={() => alert("Demo: Would split this into two shorter focused sessions.")}>
              <Zap size={13} /> Split into two meetings
            </button>
            <p className="conflict-actions__note">These actions are demo simulations and do not modify real calendars.</p>
          </div>
        )}
        <div className="tradeoff-detail">
          <div className="tradeoff-detail__header"><RotateCcw size={14} /><strong>Trade-off recommendation</strong></div>
          <p>
            {slot.conflicts.length
              ? `${slot.conflicts[0].attendee} is blocked by ${slot.conflicts[0].event.title} with ${slot.conflicts[0].duration} minutes of overlap. Choose a clear window to include everyone, or keep this slot if the conflict is acceptable.`
              : "This is a clean window: all attendees are available, the duration fits working hours, and the preferred time is preserved."}
          </p>
        </div>
        <div className="drawer-actions">
          <button className="secondary-button" onClick={() => window.open("https://meet.google.com/new", "_blank", "noopener,noreferrer")}>
            <Video size={15} /> Open Google Meet
          </button>
          <button className="primary-button" onClick={copyFormattedInvite}>
            <Clipboard size={15} /> {inviteCopied ? "Invite text copied!" : "Copy Formatted Invite"}
          </button>
        </div>
        {inviteCopied && <div className="copy-toast" role="status">Invite text copied!</div>}
      </aside>
    </div>
  );
}

// ─── Unified Results View ──────────────────────────────────────────────────────
function ResultsView({
  slots, constraints, onSelect, onBack, onTradeoff, aiStatus, parserAiStatus
}: {
  slots: Slot[];
  constraints: Constraints;
  onSelect: (slot: Slot) => void;
  onBack: () => void;
  onTradeoff: (type: "time" | "day") => void;
  aiStatus: "ai" | "fallback";
  parserAiStatus: "ai" | "fallback";
}) {
  const [detailSlot, setDetailSlot] = useState<Slot | null>(null);
  const hasPerfect = slots.some((s) => s.conflicts.length === 0);
  const bestSlot = slots[0];

  if (slots.length === 0) {
    return (
      <div className="view no-slots-view">
        <div className="no-slots-icon"><AlertTriangle size={36} /></div>
        <div className="section-kicker"><AlertTriangle size={15} /> NO SUITABLE SLOT FOUND</div>
        <h2>No available windows.</h2>
        <p className="lead">We couldn&apos;t find a slot matching all your constraints for the week of Sep 21.</p>
        <div className="no-slots-reason">
          <Sparkles size={15} />
          <p>Your <strong>{constraints.duration}-minute</strong> request with <strong>{constraints.attendees.length} attendees</strong> during{" "}
            {constraints.preferredTimes[0] ? ` ${constraints.preferredTimes[0].start}–${constraints.preferredTimes[0].end}` : " preferred hours"}{" "}
            left no suitable window. Try one of the relaxations below.
          </p>
        </div>
        <div className="no-slots-actions">
          <button className="secondary-button" onClick={() => onTradeoff("time")}><Clock3 size={14} /> Relax preferred time</button>
          <button className="secondary-button" onClick={() => onTradeoff("day")}><Calendar size={14} /> Allow any weekday</button>
          <button className="secondary-button" onClick={onBack}><RotateCcw size={14} /> Adjust constraints</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {detailSlot && <ConflictPanel slot={detailSlot} constraints={constraints} onClose={() => setDetailSlot(null)} />}
      <div className="view results-view">
        <div className="results-head">
        <div>
          <div className="section-kicker"><Zap size={15} /> ANALYSIS COMPLETE</div>
          <h2>Your best windows.</h2>
          <p className="lead">
            Ranked across {constraints.attendees.length} calendars for the week of Sep 21.
            {" "}<AiStatusBadge status={parserAiStatus} label="AI Parsed" />
          </p>
        </div>
        <button className="text-button" onClick={onBack}><RotateCcw size={15} /> Adjust constraints</button>
        </div>

      {!hasPerfect && (
        <div className="tradeoff-alert">
          <strong>No perfect match found.</strong>
          <span>These are the best available trade-offs. Open a conflict to see who is busy and why.</span>
        </div>
      )}

      <div className="insight-strip">
        <div><strong>{slots.filter((s) => s.conflicts.length === 0).length}</strong><span>clear windows</span></div>
        <div><strong>{bestSlot?.fitScore || 0}%</strong><span>top fit score</span></div>
        <div><strong>{bestSlot?.available.length || 0}/{constraints.attendees.length}</strong><span>available in top slot</span></div>
        {constraints.location && (
          <div><MapPin size={13} /><strong>{constraints.location}</strong><span style={{marginLeft:4}}>location</span></div>
        )}
      </div>

      {/* Best match hero card */}
      {bestSlot && (
        <div className="best-slot-hero">
          <div className="best-slot-hero__badge"><Star size={12} /> BEST MATCH</div>
          <div className="best-slot-hero__body">
            <div className="best-slot-hero__date">
              <span className="date-block">
                <span>{bestSlot.day.slice(0,3).toUpperCase()}</span>
                <strong>{bestSlot.date.slice(8, 10)}</strong>
                <small>SEP</small>
              </span>
            </div>
            <div className="best-slot-hero__info">
              <div className="best-slot-hero__time">{bestSlot.label}</div>
              <div className="best-slot-hero__reason">{bestSlot.reason}</div>
              <div className="best-slot-hero__attendees">
                {constraints.attendees.map((name) => {
                  const avail = bestSlot.available.includes(name);
                  return (
                    <span key={name} className={`attendee-chip ${avail ? "avail" : "conflict"}`}>
                      {avail ? <Check size={10} /> : <X size={10} />} {name}
                    </span>
                  );
                })}
              </div>
              <div className="best-slot-hero__checks">
                {bestSlot.conflicts.length === 0 && <span><Check size={12} /> Everyone available</span>}
                {bestSlot.preferenceScore >= 20 && <span><Check size={12} /> Preferred time</span>}
                {bestSlot.fairness === "High" && <span><Check size={12} /> High fairness</span>}
              </div>
            </div>
            <div className="best-slot-hero__score">
              <strong>{bestSlot.fitScore}%</strong>
              <span>fit score</span>
            </div>
          </div>
          <div className="best-slot-hero__actions">
            <button className="secondary-button" onClick={() => setDetailSlot(bestSlot)}>
              <ChevronDown size={14} /> Why this slot?
            </button>
            <button className="primary-button" onClick={() => onSelect(bestSlot)}>
              Book Slot <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Conflict-resolution table */}
      <div className="conflict-table-wrap">
        <div className="table-heading">
          <div>
            <strong>Conflict Resolution Table</strong>
            <span>Compare availability, conflicts, and fit across all recommended slots.</span>
          </div>
          <div className="table-heading__badges">
            <AiStatusBadge status={aiStatus} label="Scheduling" />
            <button className="secondary-button" onClick={() => onTradeoff("time")}><RotateCcw size={14} /> Suggest alternatives</button>
          </div>
        </div>
        {/* Desktop table */}
        <div className="conflict-table desktop-table" role="table" aria-label="Meeting slot comparison">
          <div className="conflict-table-row conflict-table-head" role="row">
            <span role="columnheader">TIME</span>
            <span role="columnheader">AVAILABLE</span>
            <span role="columnheader">CONFLICTS</span>
            <span role="columnheader">SEVERITY</span>
            <span role="columnheader">FIT</span>
            <span role="columnheader">ACTION</span>
          </div>
          {slots.map((slot, index) => (
            <div className={`conflict-table-row ${index === 0 ? "conflict-table-row--best" : ""}`} key={slot.id} role="row">
              <strong role="cell">
                {index === 0 && <span className="recommend-badge">★ BEST</span>}
                {slot.label}
              </strong>
              <span role="cell" className={slot.conflicts.length ? "partial" : "good"}>
                <Users size={11} /> {slot.available.length}/{constraints.attendees.length}
              </span>
              <span role="cell">
                {slot.conflicts.length
                  ? slot.conflicts.map((c) => (
                    <span key={c.attendee} className="conflict-name">
                      {c.attendee} · <em>{c.event.title}</em> ({c.duration}m)
                    </span>
                  ))
                  : <span className="good">None</span>}
              </span>
              <span role="cell"><span className={`severity ${slot.severity}`}>{slot.severity}</span></span>
              <strong role="cell" className="table-fit">{slot.fitScore}%</strong>
              <div role="cell" className="table-actions">
                <button className="table-detail" onClick={() => setDetailSlot(slot)}>Details <ChevronRight size={12} /></button>
                <button className="primary-button small" onClick={() => onSelect(slot)}>
                  Book <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
        {/* Mobile cards */}
        <div className="conflict-cards mobile-cards">
          {slots.map((slot, index) => (
            <div className={`conflict-card ${index === 0 ? "conflict-card--best" : ""}`} key={`card-${slot.id}`}>
              <div className="conflict-card__top">
                <div>
                  {index === 0 && <span className="recommend-badge">★ BEST</span>}
                  <strong className="conflict-card__time">{slot.label}</strong>
                </div>
                <strong className="table-fit">{slot.fitScore}%</strong>
              </div>
              <div className="conflict-card__meta">
                <span className={slot.conflicts.length ? "partial" : "good"}><Users size={11} /> {slot.available.length}/{constraints.attendees.length} available</span>
                <span className={`severity ${slot.severity}`}>{slot.severity}</span>
              </div>
              {slot.conflicts.length > 0 && (
                <div className="conflict-card__conflicts">
                  {slot.conflicts.map(c => (
                    <span key={c.attendee} className="conflict-name">{c.attendee} · {c.event.title} ({c.duration}m)</span>
                  ))}
                </div>
              )}
              <div className="conflict-card__actions">
                <button className="table-detail" onClick={() => setDetailSlot(slot)}>Details <ChevronRight size={12} /></button>
                <button className="primary-button small" onClick={() => onSelect(slot)}>Book <ArrowRight size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Other ranked slots */}
      {slots.length > 1 && (
        <div className="other-slots">
          <div className="mini-label" style={{ marginBottom: 12 }}>OTHER OPTIONS</div>
          <div className="slot-list">
            {slots.slice(1).map((slot, index) => (
              <article className="slot-card" key={slot.id}>
                <div className="slot-top">
                  <div className="date-block">
                    <span>{slot.day.slice(0, 3)}</span>
                    <strong>{slot.date.slice(8, 10)}</strong>
                    <small>SEP</small>
                  </div>
                  <div className="slot-time">
                    <div className="slot-label">#{index + 2} · {slot.label}</div>
                    <div className="slot-reason">{slot.reason}</div>
                  </div>
                  <div className="fit">
                    <strong>{slot.fitScore}%</strong>
                    <span>fit score</span>
                  </div>
                </div>
                <div className="slot-meta">
                  <span className={slot.conflicts.length ? "partial" : "good"}><Users size={14} /> {slot.available.length}/{constraints.attendees.length} available</span>
                  <span><Clock3 size={14} /> Fairness: {slot.fairness}</span>
                  {slot.conflicts.length > 0 && (
                    <button className="conflict-link" onClick={() => setDetailSlot(slot)}>
                      {slot.conflicts.length} conflict{slot.conflicts.length > 1 ? "s" : ""} <ArrowRight size={13} />
                    </button>
                  )}
                </div>
                <div className="slot-actions">
                  <button className="secondary-button" onClick={() => setDetailSlot(slot)}>Why this slot? <ChevronDown size={14} /></button>
                  <button className="primary-button small" onClick={() => onSelect(slot)}>Select slot <ArrowRight size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Explore trade-offs */}
      <div className="tradeoffs">
        <div>
          <Sparkles size={17} />
          <div>
            <strong>Explore trade-offs</strong>
            <p>Relax one preference to uncover more options.</p>
          </div>
        </div>
        <div className="tradeoff-buttons">
          <button onClick={() => onTradeoff("time")}>Relax preferred time <ArrowRight size={14} /></button>
          <button onClick={() => onTradeoff("day")}>Any weekday <ArrowRight size={14} /></button>
        </div>
      </div>
      </div>
    </>
  );
}

// ─── Input View ────────────────────────────────────────────────────────────────
function InputView({ input, setInput, onSubmit, onSample, clarification }: { input: string; setInput: (v: string) => void; onSubmit: () => void; onSample: (v: string) => void; clarification: string }) {
  return (
    <div className="view input-view">
      <div className="section-kicker"><span className="pulse" /> NEW REQUEST <span className="shortcut"><Command size={12} /> K</span></div>
      <h2>What are you trying to schedule?</h2>
      <p className="lead">Describe the meeting in your own words. SlotIQ handles the calendar math.</p>
      {clarification && <div className="tradeoff-alert" role="status"><strong>One more detail needed.</strong><span>{clarification}</span></div>}
      <div className="request-box">
        <textarea
          id="meeting-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit(); }}
          placeholder="Try: 45-minute project review with Alice and Bob next week, preferably in the afternoon…"
          aria-label="Describe your meeting"
        />
        <div className="request-footer">
          <span><Sparkles size={14} /> AI constraint extraction enabled</span>
          <button id="find-best-time-btn" className="primary-button" onClick={onSubmit}>Find best time <ArrowRight size={16} /></button>
        </div>
      </div>
      <div className="samples">
        <div className="mini-label">TRY A DEMO REQUEST</div>
        {SAMPLES.map((sample, i) => (
          <button key={sample} className="sample" onClick={() => onSample(sample)}>
            <span>0{i + 1}</span>
            <p>{sample}</p>
            <ArrowRight size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Review View ───────────────────────────────────────────────────────────────
function ReviewView({
  constraints, setConstraints, onBack, onFind, aiStatus
}: {
  constraints: Constraints;
  setConstraints: (v: Constraints) => void;
  onBack: () => void;
  onFind: () => void;
  aiStatus: "ai" | "fallback";
}) {
  return (
    <div className="view">
      <div className="section-kicker"><Check size={15} /> UNDERSTOOD</div>
      <h2>Here&apos;s what I heard.</h2>
      <p className="lead">
        Review and refine the constraints before searching calendars.{" "}
        <AiStatusBadge status={aiStatus} label="AI Parsed" />
      </p>
      <div className="review-grid">
        <div className="review-card main-review">
          <div className="card-label">MEETING PURPOSE</div>
          <input
            value={constraints.meetingPurpose}
            onChange={(e) => setConstraints({ ...constraints, meetingPurpose: e.target.value })}
            className="title-input"
            aria-label="Meeting purpose"
          />
          <div className="field-row">
            <div>
              <div className="card-label">DURATION</div>
              <select
                value={constraints.duration}
                onChange={(e) => setConstraints({ ...constraints, duration: Number(e.target.value) })}
                aria-label="Meeting duration"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
            <div>
              <div className="card-label">DATE RANGE</div>
              <div className="date-range-row">
                <input
                  type="date"
                  className="date-input"
                  value={constraints.dateRange.start}
                  onChange={(e) => setConstraints({ ...constraints, dateRange: { ...constraints.dateRange, start: e.target.value } })}
                  aria-label="Start date"
                />
                <span>→</span>
                <input
                  type="date"
                  className="date-input"
                  value={constraints.dateRange.end}
                  onChange={(e) => setConstraints({ ...constraints, dateRange: { ...constraints.dateRange, end: e.target.value } })}
                  aria-label="End date"
                />
              </div>
            </div>
          </div>
          {constraints.location !== undefined && (
            <>
              <div className="card-label">LOCATION</div>
              <div className="location-field">
                <MapPin size={14} />
                <input
                  value={constraints.location}
                  onChange={(e) => setConstraints({ ...constraints, location: e.target.value })}
                  placeholder="Conference Room B, Google Meet, or leave blank"
                  className="location-input"
                  aria-label="Meeting location"
                />
              </div>
            </>
          )}
          <div className="card-label" style={{ marginTop: 18 }}>ATTENDEES</div>
          <div className="chips">
            {constraints.attendees.map((name) => {
              const member = team.find(m => m.name === name);
              return (
                <span className="chip" key={name} title={member?.role}>
                  <span className="chip-avatar">{name[0]}</span>
                  {name}
                  {member && <small className="chip-role">{member.role}</small>}
                </span>
              );
            })}
          </div>
        </div>
        <div className="review-card constraint-summary">
          <div className="summary-row">
            <span>Preferred days</span>
            <strong>{constraints.preferredDays.length ? constraints.preferredDays.join(", ") : "Any weekday"}</strong>
          </div>
          <div className="summary-row">
            <span>Preferred time</span>
            <strong>
              {constraints.preferredTimes[0]?.start === "09:00" ? "Morning (9–12)" :
                constraints.preferredTimes[0]?.start === "13:00" ? "Afternoon (1–5)" :
                  `${constraints.preferredTimes[0]?.start} – ${constraints.preferredTimes[0]?.end}`}
            </strong>
          </div>
          <div className="summary-row">
            <span>Excluded days</span>
            <strong className="muted-red">{constraints.excludedDays.join(", ") || "None"}</strong>
          </div>
          <div className="summary-row">
            <span>Avoid</span>
            <strong className="muted-red">
              {constraints.excludedTimes.map(t => t.reason || `${t.start}–${t.end}`).join(", ") || "Nothing"}
            </strong>
          </div>
          <div className="summary-row">
            <span>Timezone</span>
            <strong>{constraints.timezone || "Asia/Kolkata"}</strong>
          </div>
          <div className="summary-note">
            <Sparkles size={15} />
            I&apos;ll rank slots by availability first, then preference fit and fairness.
          </div>
        </div>
      </div>
      <div className="action-row">
        <button className="text-button" onClick={onBack}>Back to request</button>
        <button id="confirm-find-slots-btn" className="primary-button" onClick={onFind}>
          Confirm & find slots <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Invite View ───────────────────────────────────────────────────────────────
function InviteView({
  selected, constraints, agenda, invite, copied, onCopy, onAddToGoogleCalendar, onBack, onNew, agendaAiStatus
}: {
  selected: Slot;
  constraints: Constraints;
  agenda: Agenda;
  invite: InviteDraft;
  copied: boolean;
  onCopy: () => void;
  onAddToGoogleCalendar: () => void;
  onBack: () => void;
  onNew: () => void;
  agendaAiStatus: "ai" | "fallback";
}) {
  return (
    <div className="view invite-view">
      <div className="section-kicker"><Check size={15} /> READY TO SEND</div>
      <h2>Your meeting, assembled.</h2>
      <p className="lead">
        A polished invite with agenda, ready for your calendar.{" "}
        <AiStatusBadge status={agendaAiStatus} label="AI Agenda" />
      </p>

      <div className="invite-card">
        <div className="invite-accent" />
        <div className="invite-content">
          <div className="invite-title-row">
            <div>
              <div className="card-label">MEETING INVITE</div>
              <h3>{agenda.title}</h3>
            </div>
            <span className="ready-pill"><Check size={13} /> Draft ready</span>
          </div>

          <div className="invite-details">
            <div>
              <span>WHEN</span>
              <strong>{selected.label}</strong>
              <small><Clock3 size={10} /> {constraints.duration} minutes</small>
            </div>
            <div>
              <span>ATTENDEES</span>
              <strong>{constraints.attendees.length} people</strong>
              <small>
                {constraints.attendees.map(name => {
                  const m = team.find(t => t.name === name);
                  return m ? `${m.name} (${m.role})` : name;
                }).join(" · ")}
              </small>
            </div>
            {constraints.location && (
              <div>
                <span>LOCATION</span>
                <strong><MapPin size={12} /> {constraints.location}</strong>
              </div>
            )}
            <div>
              <span>TIMEZONE</span>
              <strong>{constraints.timezone || "Asia/Kolkata"}</strong>
            </div>
          </div>

          {/* Google integration status */}
          <GoogleStatusPanel invite={invite} onConnect={() => {}} />

          <div className="invite-section">
            <div className="card-label">OBJECTIVES</div>
            <ul className="objective-list">
              {agenda.objectives.map((obj, i) => (
                <li key={i}><Check size={12} className="objective-check" /> {obj}</li>
              ))}
            </ul>
          </div>

          <div className="invite-section">
            <div className="card-label">AGENDA</div>
            {agenda.items.map((item, index) => (
              <div className="agenda-item" key={item.topic}>
                <span>0{index + 1}</span>
                <div>
                  <strong>{item.topic}</strong>
                  <p>{item.description}</p>
                </div>
                <time>{item.duration} min</time>
              </div>
            ))}
          </div>

          <div className="invite-section">
            <div className="card-label">CONFLICT RESOLUTION</div>
            {selected.conflicts.length === 0
              ? <p className="conflict-ok"><Check size={13} /> All attendees are available for this slot.</p>
              : <p className="conflict-warn"><AlertTriangle size={13} /> {selected.conflicts.map(c => c.attendee).join(", ")} {selected.conflicts.length > 1 ? "have" : "has"} a conflict — review before sending.</p>}
          </div>

          <div className="prep-note">
            <div className="card-label">EMAIL DRAFT PREVIEW</div>
            <p><strong>Subject:</strong> {invite.subject}</p>
            <pre className="email-preview">{invite.body.slice(0, 400)}{invite.body.length > 400 ? "…" : ""}</pre>
          </div>
        </div>
      </div>

      <div className="invite-actions">
        <button className="text-button" onClick={onBack}><RotateCcw size={15} /> Back to all slots</button>
        <div>
          <button className="secondary-button" onClick={onNew}>Schedule another</button>
          <button className="secondary-button" onClick={onAddToGoogleCalendar}>
            <Calendar size={16} /> Add to Google Calendar
          </button>
          <button className="secondary-button" onClick={() => window.open(`mailto:?subject=${encodeURIComponent(invite.subject)}&body=${encodeURIComponent(invite.body)}`, "_blank")}>
            <Mail size={16} /> Open email draft
          </button>
          <button id="copy-invite-btn" className="primary-button" onClick={onCopy}>
            <Clipboard size={16} /> {copied ? "Copied!" : "Copy invite"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Meetings View ─────────────────────────────────────────────────────────────
function MeetingsView({ onSchedule, meetings, syncMode }: { onSchedule: () => void; meetings: MeetingRecord[]; syncMode: "realtime" | "polling" }) {
  const conflictsResolved = meetings.filter((meeting) => meeting.conflictCount > 0).length;
  const fairness = meetings.reduce<Record<string, number>>((totals, meeting) => {
    Object.entries(meeting.attendeeConflictCounts || {}).forEach(([attendee, count]) => {
      totals[attendee] = (totals[attendee] || 0) + count;
    });
    return totals;
  }, {});
  const mostAffected = Object.entries(fairness).sort(([, a], [, b]) => b - a)[0];
  return (
    <div className="view workspace-page">
      <div className="section-kicker"><Check size={15} /> MEETING HUB <span className="sync-status" role="status">{syncMode === "realtime" ? "● Live sync" : "○ Polling fallback"}</span></div>
      <div className="page-heading">
        <div>
          <h2>Recent meetings.</h2>
          <p className="lead">Your scheduling history and ready-to-send drafts.</p>
        </div>
        <button className="primary-button" onClick={onSchedule}><Sparkles size={15} /> Schedule meeting</button>
      </div>
      <div className="meeting-stats">
        <div><strong>{meetings.length}</strong><span>meetings scheduled</span></div>
        <div><strong>{conflictsResolved}</strong><span>conflicts reviewed</span></div>
        <div><strong>{meetings.length ? Math.round(meetings.reduce((sum, meeting) => sum + meeting.fitScore, 0) / meetings.length) : 0}%</strong><span>average fit score</span></div>
        <div><strong>{mostAffected ? mostAffected[0] : "—"}</strong><span>most affected attendee</span></div>
      </div>
      <div className="meeting-list">
        {meetings.length === 0 && <div className="data-note">No scheduled meetings yet. Select a slot to create your first history entry.</div>}
        {meetings.map((meeting) => (
          <article className="meeting-row" key={meeting.id}>
            <div className="meeting-icon"><Check size={16} /></div>
            <div className="meeting-main">
              <strong>{meeting.title}</strong>
              <span>{meeting.date} · {meeting.attendees.join(", ")}</span>
            </div>
            <span className="meeting-status">{meeting.status === "scheduled" ? "Scheduled" : "Draft"}</span>
            <strong className="meeting-score">{meeting.fitScore}%</strong>
            <span className="meeting-score" title={`${meeting.conflictCount} conflicts`}>{meeting.conflictCount ? `${meeting.conflictCount} conflict${meeting.conflictCount > 1 ? "s" : ""}` : "Clear"}</span>
          </article>
        ))}
      </div>
    </div>
  );
}

// ─── Calendars View ────────────────────────────────────────────────────────────
function CalendarsView({ meetings }: { meetings: MeetingRecord[] }) {
  const scheduledEvents = meetings.flatMap((meeting) => meeting.attendees.map((attendee) => ({
    id: `scheduled-${meeting.id}-${attendee}`,
    attendee,
    day: meeting.slot.day,
    date: meeting.slot.date,
    start: meeting.slot.start,
    end: meeting.slot.end,
    title: meeting.title,
    role: team.find((member) => member.name === attendee)?.role,
  })));
  const allEvents = [...calendar, ...scheduledEvents];
  const eventByAttendee = allEvents.reduce<Record<string, typeof allEvents>>((result, event) => {
    (result[event.attendee] ||= []).push(event);
    return result;
  }, {});
  return (
    <div className="view workspace-page">
      <div className="section-kicker"><Users size={15} /> TEAM CALENDARS</div>
      <h2>Availability at a glance.</h2>
      <p className="lead">Demo calendar for the week of September 21, 2026. Real integrations use the same contract.</p>
      <div className="calendar-toolbar">
        <span />
        <span>MON 21</span><span>TUE 22</span><span>WED 23</span><span>THU 24</span><span>FRI 25</span>
      </div>
      <div className="calendar-list">
        {calendarAttendees.map((name) => {
          const member = team.find(m => m.name === name);
          return (
            <article className="calendar-person" key={name}>
              <div className="person-name">
                <span className="chip-avatar">{name[0]}</span>
                <div>
                  <strong>{name}</strong>
                  {member && <small>{member.role}</small>}
                </div>
                <small style={{ marginLeft: "auto" }}>{eventByAttendee[name]?.length || 0} busy blocks</small>
              </div>
              <div className="busy-bars">
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => {
                  const events = eventByAttendee[name]?.filter((item) => item.day === day) || [];
                  return (
                    <div className={`busy-cell ${events.length ? "busy" : "open"}`} key={day} title={events.length ? events.map((event) => `${event.title}, ${event.start}–${event.end}`).join(" | ") : `${name} is open`}>
                      <span>{events.length ? events.map((event) => `${event.title} (${event.start}–${event.end})`).join(" · ") : "Open"}</span>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
      <div className="data-note">
        <Sparkles size={16} />
        <span><strong>Calendar adapter ready.</strong> Connect Google Calendar or Outlook later without changing the scheduling engine.</span>
      </div>
    </div>
  );
}

// ─── Clipboard Fallback Modal ──────────────────────────────────────────────────
function ClipboardFallback({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Manual copy">
      <div className="clipboard-fallback" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="section-kicker"><AlertTriangle size={14} /> CLIPBOARD ACCESS BLOCKED</div>
        <h3>Unable to copy automatically.</h3>
        <p>Your browser blocked automatic clipboard access. Select all the text below and copy it manually.</p>
        <textarea
          className="fallback-textarea"
          readOnly
          value={text}
          onFocus={(e) => e.target.select()}
          aria-label="Invite text to copy manually"
        />
        <button className="primary-button" onClick={() => { const ta = document.querySelector<HTMLTextAreaElement>(".fallback-textarea"); ta?.select(); document.execCommand("copy"); }}>
          <Clipboard size={14} /> Select All &amp; Copy
        </button>
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [input, setInput] = useState(SAMPLES[0]);
  const [step, setStep] = useState<Step>("input");
  const [constraints, setConstraints] = useState<Constraints | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [invite, setInvite] = useState<InviteDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [clipboardFallback, setClipboardFallback] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("schedule");
  const [aiStatus, setAiStatus] = useState<AiStatus>({ parserUsed: "fallback", agendaUsed: "fallback" });
  const [agendaAiStatus, setAgendaAiStatus] = useState<"ai" | "fallback">("fallback");
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [clarification, setClarification] = useState("");
  const [clarificationState, setClarificationState] = useState<ClarificationState | undefined>();
  const [syncMode, setSyncMode] = useState<"realtime" | "polling">("polling");

  useEffect(() => {
    const loadMeetings = () => fetch("/api/meetings")
      .then(async (response) => {
        const data: { meetings: MeetingRecord[]; error?: string } = await response.json();
        if (!response.ok) throw new Error(data.error || "Meeting history is unavailable.");
        setMeetings(data.meetings);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Meeting history is unavailable."));
    loadMeetings();
    const supabase = getSupabaseBrowser();
    const channel = supabase?.channel("meeting-history-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_history" }, loadMeetings)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setSyncMode("realtime");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setSyncMode("polling");
      });
    const refresh = window.setInterval(loadMeetings, 15000);
    return () => {
      window.clearInterval(refresh);
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, []);

  async function parseMeeting() {
    if (!input.trim()) return setError("Tell me a little about the meeting first.");
    setError(""); setLoading(true); setLoadingStage(1);
    try {
      const response = await fetch("/api/parse-meeting-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          clarificationState,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data: ParseResponse = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.needsClarification || !data.constraints) {
        setClarification(data.clarification || "Please add the meeting duration and attendees.");
        setClarificationState(data.clarificationState);
        setInput("");
        setStep("input");
        return;
      }
      setClarification("");
      setClarificationState(undefined);
      setConstraints(data.constraints);
      setAiStatus(prev => ({ ...prev, parserUsed: data.aiStatus || "fallback" }));
      setStep("review");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally { setLoading(false); }
  }

  async function findSlots(nextConstraints = constraints) {
    if (!nextConstraints) return;
    setError(""); setLoading(true); setLoadingStage(3);
    try {
      await new Promise((r) => setTimeout(r, 350));
      setLoadingStage(4);
      const response = await fetch("/api/find-meeting-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextConstraints),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSlots(data.slots);
      setStep("results");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Availability analysis failed.");
    } finally { setLoading(false); }
  }

  async function chooseSlot(slot: Slot) {
    if (!constraints) return;
    setSelected(slot); setLoading(true); setLoadingStage(5); setError("");
    try {
      const response = await fetch("/api/generate-agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constraints, slot }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAgenda(data.agenda);
      setInvite(data.invite);
      setAgendaAiStatus(data.agendaAiStatus || "fallback");
      const record: MeetingRecord = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        title: data.agenda.title,
        date: slot.date,
        attendees: constraints.attendees,
        status: "scheduled",
        fitScore: slot.fitScore,
        conflictCount: slot.conflicts.length,
        attendeeConflictCounts: constraints.attendees.reduce<Record<string, number>>((counts, attendee) => {
          counts[attendee] = slot.conflicts.filter((conflict) => conflict.attendee === attendee).length;
          return counts;
        }, {}),
        constraints,
        slot,
        agenda: data.agenda,
      };
      const historyResponse = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      if (!historyResponse.ok) {
        const historyError = await historyResponse.json();
        setError(historyError.error || "Meeting was created, but history could not be saved.");
      } else {
        setMeetings((current) => [record, ...current]);
      }
      setStep("invite");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agenda generation failed.");
    } finally { setLoading(false); }
  }

  function toggleTradeoff(type: "time" | "day") {
    if (!constraints) return;
    const next = {
      ...constraints,
      ...(type === "time"
        ? { preferredTimes: [{ start: "09:00", end: "18:00" }] }
        : { preferredDays: [] }),
    };
    setConstraints(next);
    findSlots(next);
  }

  const copyInvite = useCallback(async () => {
    if (!invite) return;
    const text = invite.body;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setClipboardFallback(true);
    }
  }, [invite]);

  const addToGoogleCalendar = useCallback(() => {
    if (!selected || !agenda || !constraints) return;
    const offset = constraints.timezone === "Asia/Kolkata" ? "+05:30" : "Z";
    const formatGoogleDate = (time: string) => new Date(`${selected.date}T${time}:00${offset}`)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
    const attendeeEmails = constraints.attendees
      .map((name) => team.find((member) => member.name === name)?.email)
      .filter((email): email is string => Boolean(email))
      .join(",");
    const details = [
      "Agenda:",
      ...agenda.items.map((item, index) => `${index + 1}. ${item.topic} (${item.duration} min) — ${item.description}`),
      "",
      `Objectives: ${agenda.objectives.join("; ")}`,
      `Preparation: ${agenda.preparationNotes}`,
      "",
      "Scheduled via SlotIQ",
    ].join("\n");
    const query = new URLSearchParams({
      action: "TEMPLATE",
      text: agenda.title,
      dates: `${formatGoogleDate(selected.start)}/${formatGoogleDate(selected.end)}`,
      details,
      add: attendeeEmails,
    });
    if (constraints.location) query.set("location", constraints.location);
    window.open(`https://calendar.google.com/calendar/render?${query.toString()}`, "_blank", "noopener,noreferrer");
  }, [agenda, constraints, selected]);

  const loadingMessage = LOADING_MESSAGES[Math.min(loadingStage, LOADING_MESSAGES.length - 1)];
  const stepLabels = ["Describe", "Review", "Find slots", "Ready to send"];
  const progress = { input: 1, review: 2, results: 3, invite: 4 }[step];

  return (
    <main className="app-shell">
      {/* Google Toast */}
      {/* Clipboard fallback modal */}
      {clipboardFallback && invite && (
        <ClipboardFallback text={invite.body} onClose={() => setClipboardFallback(false)} />
      )}

      {/* Top nav */}
      <nav className="topbar" aria-label="Primary navigation">
        <button className="brand brand-button" onClick={() => setWorkspaceView("schedule")} aria-label="SlotIQ home">
          <span className="brand-mark" />
          <span>Slot<span className="brand-accent">IQ</span></span>
        </button>
        <div className="nav-links">
          <button className={`nav-link ${workspaceView === "schedule" ? "active" : ""}`} onClick={() => setWorkspaceView("schedule")} aria-current={workspaceView === "schedule" ? "page" : undefined}>Schedule</button>
          <button className={`nav-link ${workspaceView === "meetings" ? "active" : ""}`} onClick={() => setWorkspaceView("meetings")} aria-current={workspaceView === "meetings" ? "page" : undefined}>Meetings</button>
          <button className={`nav-link ${workspaceView === "calendars" ? "active" : ""}`} onClick={() => setWorkspaceView("calendars")} aria-current={workspaceView === "calendars" ? "page" : undefined}>Team calendars</button>
        </div>
        <div className="nav-meta">
          <button className="avatar" aria-label="Open account menu">VA</button>
        </div>
      </nav>

      {/* Workspace */}
      <div className="workspace">
        <aside className="sidebar" aria-label="Sidebar">
          <div className="eyebrow">AI SCHEDULING OS</div>
          <h1>Seamless scheduling.<br /><em>Smarter meetings.</em></h1>
          <p className="side-copy">Turn a messy meeting request into a time everyone can actually make.</p>
          {workspaceView === "schedule" && (
            <div className="stepper" role="list" aria-label="Scheduling steps">
              {stepLabels.map((label, index) => (
                <div className={`step ${index + 1 <= progress ? "active" : ""}`} key={label} role="listitem">
                  <span aria-hidden="true">{index + 1 <= progress ? <Check size={13} /> : index + 1}</span>
                  {label}
                </div>
              ))}
            </div>
          )}
          <div className="sidebar-foot">
            <div className="mini-label">DEMO DATA</div>
            <p>6 teammate calendars<br />Week of Sep 21, 2026<br />Timezone: IST</p>
          </div>
        </aside>

        <section className="content">
          {workspaceView === "meetings" && <MeetingsView meetings={meetings} onSchedule={() => setWorkspaceView("schedule")} syncMode={syncMode} />}
          {workspaceView === "calendars" && <CalendarsView meetings={meetings} />}
          {workspaceView === "schedule" && (
            <>
              {loading && (
                <div className="loading-bar" role="progressbar" aria-label={loadingMessage}>
                  <span style={{ width: `${loadingStage * 16}%` }} />
                  <span className="loading-label">{loadingMessage}</span>
                </div>
              )}
              {error && (
                <div className="error-banner" role="alert">
                  <X size={16} /> {error}
                  <button className="error-dismiss" onClick={() => setError("")} aria-label="Dismiss error">×</button>
                </div>
              )}
              {step === "input" && <InputView input={input} setInput={setInput} onSubmit={parseMeeting} onSample={setInput} clarification={clarification} />}
              {step === "review" && constraints && (
                <ReviewView
                  constraints={constraints}
                  setConstraints={setConstraints}
                  onBack={() => setStep("input")}
                  onFind={() => findSlots()}
                  aiStatus={aiStatus.parserUsed}
                />
              )}
              {step === "results" && constraints && (
                <ResultsView
                  slots={slots}
                  constraints={constraints}
                  onSelect={chooseSlot}
                  onBack={() => setStep("review")}
                  onTradeoff={toggleTradeoff}
                  aiStatus="fallback"
                  parserAiStatus={aiStatus.parserUsed}
                />
              )}
              {step === "invite" && constraints && selected && agenda && invite && (
                <InviteView
                  selected={selected}
                  constraints={constraints}
                  agenda={agenda}
                  invite={invite}
                  copied={copied}
                  onCopy={copyInvite}
                  onAddToGoogleCalendar={addToGoogleCalendar}
                  onBack={() => setStep("results")}
                  onNew={() => { setStep("input"); setAgenda(null); setSelected(null); setInvite(null); }}
                  agendaAiStatus={agendaAiStatus}
                />
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}