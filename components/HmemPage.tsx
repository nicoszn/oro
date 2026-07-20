'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Radio
} from 'lucide-react';



// ---------- Types mirroring lib/hmem's EngineEvent shape ----------

type EngineEventType =
  | 'simulation_start'
  | 'turn_start'
  | 'routing_decision'
  | 'schema_extraction'
  | 'graph_insert'
  | 'graph_connect'
  | 'llm_call_start'
  | 'llm_call_end'
  | 'retrieval'
  | 'turn_complete'
  | 'simulation_complete'
  | 'error';

interface EngineEvent {
  type: EngineEventType;
  timestamp: number;
  turn?: number;
  agentId?: string;
  message: string;
  data?: Record<string, any>;
}

type Destination = 'tier2' | 'tier3' | 'dropped';

interface RoutingPacket {
  key: string;
  blockId: string;
  destination: Destination;
  score: number;
  turn: number;
}

interface LLMCall {
  callId: string;
  purpose: 'schema_extraction' | 'turn_analysis';
  agentId: string;
  turn: number;
  status: 'pending' | 'success' | 'failed';
  durationMs?: number;
  preview?: string;
}

interface TurnState {
  turn: number;
  agentId: string;
  status: 'pending' | 'active' | 'complete';
  output?: string;
}

interface GraphNodePreview {
  key: string;
  nodeId: string;
  description: string;
}

const AGENT_SEQUENCE = [
  'Security_Agent',
  'Logistics_Agent',
  'Communications_Agent',
  'Analytics_Agent'
];

const initialTurns = (): TurnState[] =>
  AGENT_SEQUENCE.map((agentId, i) => ({ turn: i + 1, agentId, status: 'pending' }));

export default function HmemPage() {
  const shouldReduceMotion = useReducedMotion();
  const eventSourceRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const [status, setStatus] = useState<'idle' | 'streaming' | 'complete' | 'error'>('idle');
  const [rawLog, setRawLog] = useState<string[]>([]);
  const [logExpanded, setLogExpanded] = useState(true);

  const [turns, setTurns] = useState<TurnState[]>(initialTurns());
  const [tierStats, setTierStats] = useState({ t1Tokens: 0, t2Vectors: 0, t3Nodes: 0, t3Edges: 0 });
  const [t1Preview, setT1Preview] = useState<string>('');

  const [t2Packets, setT2Packets] = useState<RoutingPacket[]>([]);
  const [t3Packets, setT3Packets] = useState<RoutingPacket[]>([]);
  const [droppedPackets, setDroppedPackets] = useState<RoutingPacket[]>([]);

  const [graphNodes, setGraphNodes] = useState<GraphNodePreview[]>([]);
  const [llmCalls, setLlmCalls] = useState<LLMCall[]>([]);
  const [retrievalPreview, setRetrievalPreview] = useState<{ vectorHits: string[]; graphContext: string } | null>(null);

  const [finalSnapshot, setFinalSnapshot] = useState<string | null>(null);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [runDurationMs, setRunDurationMs] = useState<number | null>(null);

  useEffect(() => {
    if (logExpanded) logEndRef.current?.scrollIntoView({ block: 'end' });
  }, [rawLog, logExpanded]);

  useEffect(() => {
    return () => eventSourceRef.current?.close();
  }, []);

  const handleEvent = useCallback((event: EngineEvent) => {
    setRawLog(prev => [...prev, `[${new Date(event.timestamp).toLocaleTimeString()}] ${event.type} — ${event.message}`]);

    switch (event.type) {
      case 'simulation_start': {
        setRunStartedAt(event.timestamp);
        break;
      }
      case 'turn_start': {
        setTurns(prev => prev.map(t => (t.turn === event.turn ? { ...t, status: 'active' } : t)));
        setT1Preview(String(event.data?.inputPayload ?? ''));
        break;
      }
      case 'routing_decision': {
        const destination = event.data?.destination as Destination;
        const packet: RoutingPacket = {
          key: `${event.data?.blockId}_${event.timestamp}`,
          blockId: String(event.data?.blockId ?? ''),
          destination,
          score: Number(event.data?.score ?? 0),
          turn: event.turn ?? 0
        };
        if (destination === 'tier2') setT2Packets(prev => [packet, ...prev].slice(0, 6));
        else if (destination === 'tier3') setT3Packets(prev => [packet, ...prev].slice(0, 6));
        else setDroppedPackets(prev => [packet, ...prev].slice(0, 6));
        setTierStats(prev =>
          destination === 'tier2' ? { ...prev, t2Vectors: prev.t2Vectors + 1 } : prev
        );
        break;
      }
      case 'graph_insert': {
        setGraphNodes(prev =>
          [
            { key: `${event.data?.nodeId}_${event.timestamp}`, nodeId: String(event.data?.nodeId ?? ''), description: String(event.data?.description ?? '') },
            ...prev
          ].slice(0, 8)
        );
        break;
      }
      case 'llm_call_start': {
        const callId = String(event.data?.callId ?? '');
        const newCall: LLMCall = {
          callId,
          purpose: event.data?.purpose,
          agentId: event.agentId ?? '',
          turn: event.turn ?? 0,
          status: 'pending'
        };
        setLlmCalls(prev => [newCall, ...prev].slice(0, 10));
        break;
      }
      case 'llm_call_end': {
        const callId = String(event.data?.callId ?? '');
        setLlmCalls(prev =>
          prev.map(c =>
            c.callId === callId
              ? {
                  ...c,
                  status: event.data?.success ? 'success' : 'failed',
                  durationMs: event.data?.durationMs,
                  preview: event.data?.preview
                }
              : c
          )
        );
        break;
      }
      case 'retrieval': {
        setRetrievalPreview({
          vectorHits: event.data?.vectorHits ?? [],
          graphContext: event.data?.graphContextPreview ?? ''
        });
        break;
      }
      case 'turn_complete': {
        setTurns(prev =>
          prev.map(t => (t.turn === event.turn ? { ...t, status: 'complete', output: event.message } : t))
        );
        setTierStats(prev => ({
          ...prev,
          t1Tokens: Number(event.data?.tokenCount ?? prev.t1Tokens),
          t3Nodes: Number(event.data?.graphNodes ?? prev.t3Nodes),
          t3Edges: Number(event.data?.graphEdges ?? prev.t3Edges)
        }));
        break;
      }
      case 'simulation_complete': {
        setFinalSnapshot(String(event.data?.graphSnapshot ?? ''));
        setStatus('complete');
        setRunDurationMs(runStartedAt ? event.timestamp - runStartedAt : null);
        eventSourceRef.current?.close();
        break;
      }
      case 'error': {
        setStatus('error');
        eventSourceRef.current?.close();
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runStartedAt]);

  const runSimulation = () => {
    eventSourceRef.current?.close();
    setStatus('streaming');
    setRawLog([]);
    setTurns(initialTurns());
    setTierStats({ t1Tokens: 0, t2Vectors: 0, t3Nodes: 0, t3Edges: 0 });
    setT1Preview('');
    setT2Packets([]);
    setT3Packets([]);
    setDroppedPackets([]);
    setGraphNodes([]);
    setLlmCalls([]);
    setRetrievalPreview(null);
    setFinalSnapshot(null);
    setRunDurationMs(null);

    const es = new EventSource('/api/hmem');
    eventSourceRef.current = es;
    es.onmessage = e => {
      try {
        handleEvent(JSON.parse(e.data));
      } catch {
        /* ignore malformed frame */
      }
    };
    es.onerror = () => {
      setStatus(prev => (prev === 'streaming' ? 'error' : prev));
      es.close();
    };
  };

  const t = shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' as const };

  return (
    <div className="min-h-screen bg-[#0C0E0D] text-[#EDEAE1] antialiased" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Header */}
      <nav className="border-b border-[rgba(237,234,225,0.08)] bg-[#0C0E0D]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radio className="w-4 h-4 text-[#E8A33D]" strokeWidth={2} />
            <span
              className="font-bold text-base sm:text-lg tracking-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              H-MEM <span className="text-[#8A9290] font-normal">· ROUTING DECK</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <StatusPill status={status} />
            <button
              onClick={runSimulation}
              disabled={status === 'streaming'}
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md bg-[#E8A33D] text-[#0C0E0D] hover:bg-[#F0B457] transition-colors disabled:opacity-40 disabled:pointer-events-none"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {status === 'streaming' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {status === 'streaming' ? 'Running' : 'Run Simulation'}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Turn timeline — order is real here: four agents run in a fixed sequence */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {turns.map(turn => (
            <TurnCard key={turn.turn} turn={turn} transition={t} />
          ))}
        </div>

        {/* Three tier lanes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <TierLane
            index={1}
            name="Working Scratchpad"
            accent="#E8A33D"
            metricLabel="tokens active"
            metricValue={`${tierStats.t1Tokens} / 1024`}
            barFraction={Math.min(1, tierStats.t1Tokens / 1024)}
          >
            <p className="text-xs text-[#8A9290] mb-2" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              current event
            </p>
            <p className="text-sm leading-relaxed text-[#EDEAE1]/90 line-clamp-4">
              {t1Preview || 'Idle — no active turn.'}
            </p>
          </TierLane>

          <TierLane
            index={2}
            name="Compressed Index"
            accent="#4E9C93"
            metricLabel="vectors committed"
            metricValue={String(tierStats.t2Vectors)}
          >
            <PacketFeed packets={t2Packets} accent="#4E9C93" scoreLabel="decay" transition={t} />
          </TierLane>

          <TierLane
            index={3}
            name="Semantic Graph"
            accent="#9A7AB0"
            metricLabel="nodes · edges"
            metricValue={`${tierStats.t3Nodes} · ${tierStats.t3Edges}`}
          >
            <PacketFeed packets={t3Packets} accent="#9A7AB0" scoreLabel="sim" transition={t} />
          </TierLane>
        </div>

        {/* Discard trail */}
        {droppedPackets.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            <span className="text-[10px] uppercase tracking-wider text-[#8A9290] shrink-0" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              discarded
            </span>
            <AnimatePresence>
              {droppedPackets.map(p => (
                <motion.span
                  key={p.key}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  exit={{ opacity: 0 }}
                  transition={t}
                  className="text-[10px] px-2 py-0.5 rounded border border-[rgba(237,234,225,0.1)] text-[#8A9290] shrink-0"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {p.blockId.slice(0, 18)}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* LLM activity + retrieval */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="LLM Call Activity" tag="OPENROUTER">
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {llmCalls.length === 0 && <EmptyNote text="No calls yet — run the simulation to see live requests." />}
              <AnimatePresence initial={false}>
                {llmCalls.map(call => (
                  <motion.div
                    key={call.callId}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={t}
                    className="flex items-start gap-2 text-xs border border-[rgba(237,234,225,0.08)] rounded-md px-3 py-2"
                  >
                    {call.status === 'pending' && <Loader2 className="w-3.5 h-3.5 mt-0.5 animate-spin text-[#E8A33D] shrink-0" />}
                    {call.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-[#6FAE7A] shrink-0" />}
                    {call.status === 'failed' && <XCircle className="w-3.5 h-3.5 mt-0.5 text-[#C1544A] shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace" }} className="text-[#EDEAE1]">
                          {call.agentId} · turn {call.turn} · {call.purpose === 'schema_extraction' ? 'schema extraction' : 'turn analysis'}
                        </span>
                        {call.durationMs !== undefined && (
                          <span className="text-[#8A9290] shrink-0" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                            {call.durationMs}ms
                          </span>
                        )}
                      </div>
                      {call.preview && <p className="text-[#8A9290] mt-1 truncate">{call.preview}</p>}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </Panel>

          <Panel title="Retrieval Context" tag="LIVE">
            {retrievalPreview ? (
              <div className="space-y-3 text-xs">
                <div>
                  <p className="text-[#8A9290] mb-1 uppercase tracking-wider text-[10px]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    T2 vector hits
                  </p>
                  {retrievalPreview.vectorHits.length > 0 ? (
                    retrievalPreview.vectorHits.map((hit, i) => (
                      <p key={i} className="text-[#EDEAE1]/80 truncate" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                        {hit}
                      </p>
                    ))
                  ) : (
                    <p className="text-[#8A9290]">none yet</p>
                  )}
                </div>
                <div>
                  <p className="text-[#8A9290] mb-1 uppercase tracking-wider text-[10px]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    T3 graph context
                  </p>
                  <pre className="whitespace-pre-wrap text-[#9A7AB0]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                    {retrievalPreview.graphContext}
                  </pre>
                </div>
              </div>
            ) : (
              <EmptyNote text="No retrieval yet — appears once the first turn queries the graph." />
            )}
          </Panel>
        </div>

        {/* Recent graph nodes */}
        {graphNodes.length > 0 && (
          <Panel title="Recently Inserted Concepts" tag={`${graphNodes.length}`}>
            <div className="grid sm:grid-cols-2 gap-2">
              <AnimatePresence initial={false}>
                {graphNodes.map(n => (
                  <motion.div
                    key={n.key}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={t}
                    className="text-xs border border-[rgba(154,122,176,0.25)] bg-[#9A7AB0]/5 rounded-md px-3 py-2"
                  >
                    <span className="text-[#9A7AB0] font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                      {n.nodeId}
                    </span>
                    <p className="text-[#8A9290] mt-0.5">{n.description}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </Panel>
        )}

        {/* Raw log */}
        <div className="border border-[rgba(237,234,225,0.08)] rounded-xl overflow-hidden">
          <button
            onClick={() => setLogExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#131513] hover:bg-[#171917] transition-colors"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8A9290]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              Execution Log — {rawLog.length} events
            </span>
            {logExpanded ? <ChevronUp className="w-4 h-4 text-[#8A9290]" /> : <ChevronDown className="w-4 h-4 text-[#8A9290]" />}
          </button>
          {logExpanded && (
            <div className="h-56 overflow-y-auto p-4 text-xs leading-relaxed text-[#8A9290]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {rawLog.length === 0 ? (
                <p className="italic">Console idle. Run the simulation to stream events.</p>
              ) : (
                rawLog.map((line, i) => (
                  <div key={i} className="py-0.5">
                    {line}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          )}
        </div>

        {/* Final snapshot */}
        {status === 'complete' && finalSnapshot && (
          <Panel title="Final Graph Snapshot" tag={runDurationMs ? `${runDurationMs}ms total` : 'DONE'}>
            <pre className="whitespace-pre-wrap text-xs text-[#EDEAE1]/80 max-h-72 overflow-y-auto" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {finalSnapshot}
            </pre>
          </Panel>
        )}
      </main>
    </div>
  );
}

// ---------- Subcomponents ----------

function StatusPill({ status }: { status: 'idle' | 'streaming' | 'complete' | 'error' }) {
  const config = {
    idle: { color: '#8A9290', label: 'IDLE' },
    streaming: { color: '#E8A33D', label: 'STREAMING' },
    complete: { color: '#6FAE7A', label: 'COMPLETE' },
    error: { color: '#C1544A', label: 'ERROR' }
  }[status];

  return (
    <div className="hidden sm:flex items-center gap-2 text-[10px] uppercase tracking-wider" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: config.color, boxShadow: status === 'streaming' ? `0 0 8px ${config.color}` : undefined }}
      />
      <span style={{ color: config.color }}>{config.label}</span>
    </div>
  );
}

function TurnCard({ turn, transition }: { turn: TurnState; transition: any }) {
  const statusIcon = {
    pending: <Circle className="w-3.5 h-3.5 text-[#8A9290]" />,
    active: <Loader2 className="w-3.5 h-3.5 text-[#E8A33D] animate-spin" />,
    complete: <CheckCircle2 className="w-3.5 h-3.5 text-[#6FAE7A]" />
  }[turn.status];

  return (
    <motion.div
      animate={{
        borderColor: turn.status === 'active' ? '#E8A33D' : 'rgba(237,234,225,0.08)'
      }}
      transition={transition}
      className="border rounded-lg p-3 bg-[#131513]"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-[#8A9290]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          {String(turn.turn).padStart(2, '0')}
        </span>
        {statusIcon}
      </div>
      <p className="text-xs font-semibold truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        {turn.agentId.replace('_', ' ')}
      </p>
      {turn.output && <p className="text-[10px] text-[#8A9290] mt-1 line-clamp-2">{turn.output}</p>}
    </motion.div>
  );
}

function TierLane({
  index,
  name,
  accent,
  metricLabel,
  metricValue,
  barFraction,
  children
}: {
  index: number;
  name: string;
  accent: string;
  metricLabel: string;
  metricValue: string;
  barFraction?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-xl p-4 bg-[#131513] flex flex-col" style={{ borderColor: `${accent}33` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-[#8A9290]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          Tier {index}
        </span>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", color: accent }}>
        {name}
      </h3>
      <div className="mb-3">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            {metricValue}
          </span>
          <span className="text-[10px] text-[#8A9290]">{metricLabel}</span>
        </div>
        {barFraction !== undefined && (
          <div className="h-1 bg-[rgba(237,234,225,0.08)] rounded-full mt-2 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${barFraction * 100}%`, backgroundColor: accent }} />
          </div>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function PacketFeed({
  packets,
  accent,
  scoreLabel,
  transition
}: {
  packets: RoutingPacket[];
  accent: string;
  scoreLabel: string;
  transition: any;
}) {
  if (packets.length === 0) {
    return <EmptyNote text="No routing activity yet." />;
  }
  return (
    <div className="space-y-1.5">
      <AnimatePresence initial={false}>
        {packets.map(p => (
          <motion.div
            key={p.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={transition}
            className="flex items-center justify-between text-[11px] rounded px-2 py-1"
            style={{ backgroundColor: `${accent}14`, fontFamily: "'IBM Plex Mono', monospace" }}
          >
            <span className="truncate flex-1" style={{ color: accent }}>
              {p.blockId.split('_').slice(1, 3).join('_')}
            </span>
            <span className="text-[#8A9290] ml-2 shrink-0">
              {scoreLabel} {p.score.toFixed(2)}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Panel({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="border border-[rgba(237,234,225,0.08)] rounded-xl bg-[#131513] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8A9290]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          {title}
        </h3>
        {tag && (
          <span className="text-[10px] px-2 py-0.5 rounded border border-[rgba(237,234,225,0.1)] text-[#8A9290]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            {tag}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[#8A9290] italic py-2">
      <ArrowRight className="w-3 h-3" />
      {text}
    </div>
  );
}
