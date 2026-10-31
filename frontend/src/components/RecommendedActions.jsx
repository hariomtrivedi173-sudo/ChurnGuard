import React from 'react'
import { Phone, Mail, Tag, Sparkles, Info, ShieldCheck, CheckCircle2 } from 'lucide-react'

/**
 * RecommendedActions component
 * Renders rule-based retention actions with channel and priority badges.
 *
 * Props:
 * - suggestions: Array of { title, reason, priority: 'High'|'Medium'|'Low', channel: 'Call'|'Email'|'Offer' }
 * - loading: boolean
 * - title: optional custom heading
 * - compact: boolean (for smaller containers)
 */
export default function RecommendedActions({
  suggestions = [],
  loading = false,
  title = "Rule-Based Retention Suggestions",
  compact = false
}) {
  if (loading) {
    return (
      <div style={{
        padding: '16px',
        borderRadius: '10px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        color: 'var(--text-muted)',
        fontSize: '13px'
      }}>
        <div style={{
          width: '14px', height: '14px',
          border: '2px solid var(--border)',
          borderTopColor: 'var(--brand)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <span>Evaluating retention playbooks…</span>
      </div>
    )
  }

  const items = Array.isArray(suggestions) ? suggestions : []

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'High':
        return <span className="badge badge-red" style={{ fontSize: '10px' }}>● High Priority</span>
      case 'Medium':
        return <span className="badge badge-yellow" style={{ fontSize: '10px' }}>● Medium Priority</span>
      case 'Low':
      default:
        return <span className="badge badge-green" style={{ fontSize: '10px' }}>● Low Priority</span>
    }
  }

  const getChannelBadge = (channel) => {
    switch (channel) {
      case 'Call':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '6px',
            background: 'var(--brand-subtle)',
            color: 'var(--brand)'
          }}>
            <Phone size={11} /> Phone Call
          </span>
        )
      case 'Email':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '6px',
            background: 'var(--info-subtle)',
            color: 'var(--info)'
          }}>
            <Mail size={11} /> Direct Email
          </span>
        )
      case 'Offer':
      default:
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '6px',
            background: 'var(--warning-subtle)',
            color: 'var(--warning)'
          }}>
            <Tag size={11} /> Discount / Offer
          </span>
        )
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={14} color="var(--brand)" />
          <h4 style={{
            fontSize: compact ? '12px' : '13px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0
          }}>
            {title}
          </h4>
        </div>
        <span style={{
          fontSize: '10px',
          fontWeight: 600,
          color: 'var(--text-muted)',
          background: 'var(--surface-muted)',
          padding: '2px 6px',
          borderRadius: '4px'
        }}>
          {items.length} {items.length === 1 ? 'Action' : 'Actions'}
        </span>
      </div>

      {/* Suggestion list */}
      {items.length === 0 ? (
        <div style={{
          padding: '16px',
          borderRadius: '10px',
          background: 'var(--surface-muted)',
          border: '1px solid var(--border)',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '12px'
        }}>
          <CheckCircle2 size={18} color="var(--success)" style={{ margin: '0 auto 6px auto' }} />
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>No immediate action required</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px' }}>Account indicators remain healthy. Continue standard customer monitoring.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((s, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderLeft: s.priority === 'High' ? '3px solid var(--danger)' : s.priority === 'Medium' ? '3px solid var(--warning)' : '3px solid var(--brand)',
                borderRadius: '8px',
                padding: compact ? '10px 12px' : '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                transition: 'border-color 150ms ease'
              }}
            >
              {/* Badges + Title */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{
                  fontSize: compact ? '12px' : '13px',
                  fontWeight: 700,
                  color: 'var(--text-primary)'
                }}>
                  {s.title}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {s.channel && getChannelBadge(s.channel)}
                  {s.priority && getPriorityBadge(s.priority)}
                </div>
              </div>

              {/* Rationale / Reason */}
              {s.reason && (
                <p style={{
                  fontSize: compact ? '11px' : '12px',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: 1.45
                }}>
                  {s.reason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Mandatory Disclaimer */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '6px',
        padding: '8px 10px',
        background: 'var(--surface-muted)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        lineHeight: 1.4
      }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--text-muted)' }} />
        <span>Suggestions are rule-based and meant to guide your team, not guaranteed results.</span>
      </div>
    </div>
  )
}

