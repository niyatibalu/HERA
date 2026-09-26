import type { RouteOption } from '../types'
import { Icon, type IconName } from './Icon'

const MODE_ICON: Record<RouteOption['mode'], IconName> = { fastest: 'car', safer: 'shield', transit: 'bus', telehealth: 'video' }

/**
 * Route choices from the access-map service (feature/access-map). This component only presents
 * the options; routing, weather and road scoring live in the map module.
 */
export function RouteOptions({ options, selected, onSelect }: { options: RouteOption[]; selected?: string; onSelect?: (routeId: string) => void }) {
  return (
    <div className="routes" role="radiogroup" aria-label="Ways to reach care">
      {options.map((o) => {
        const on = selected === o.route_id
        return (
          <button
            key={o.route_id}
            type="button"
            role="radio"
            aria-checked={on}
            className={`route ${o.recommended ? 'is-recommended' : ''} ${on ? 'is-on' : ''}`}
            onClick={() => onSelect?.(o.route_id)}
            disabled={!onSelect}
          >
            <div className="route-top">
              <Icon name={MODE_ICON[o.mode]} size={16} />
              <span className="route-label">{o.label}</span>
              {o.recommended && <span className="badge badge-accent">Recommended</span>}
            </div>
            <div className="route-time num">{o.duration_minutes != null ? `${o.duration_minutes} min` : 'No travel'}</div>
            <div className="route-summary">{o.summary}</div>
            <div className="route-conds">
              {o.conditions.map((c) => (
                <span key={c} className={`badge ${/snow|ice|unplowed|no services/i.test(c) ? 'badge-review' : ''}`}>
                  {/snow|ice/i.test(c) && <Icon name="snow" size={11} />}
                  {c}
                </span>
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
