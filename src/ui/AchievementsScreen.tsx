/**
 * Achievements gallery: unlocked vs locked, grouped by category.
 */

import { useMemo, useState } from 'react';
import type { Activity } from '../core/activity';
import {
  ACHIEVEMENT_CATEGORY_LABEL,
  ACHIEVEMENTS,
  loadUnlocks,
  refreshAchievements,
  type AchievementCategory,
  type AchievementDef,
} from '../core/achievements';
import type { Profile } from '../core/settings';
import { useT } from '../i18n/react';
import { useLocale } from '../i18n/react';
import { AchievementIcon } from './AchievementIcon';

interface Props {
  profile: Profile;
  activities: Activity[];
  onBack(): void;
  onToast?(message: string): void;
}

const CATEGORY_ORDER: AchievementCategory[] = [
  'distance',
  'lifetime',
  'recovery',
  'performance',
  'app',
  'fun',
];

export function AchievementsScreen({ profile, activities, onBack, onToast }: Props) {
  const t = useT();
  const { tag } = useLocale();
  // Re-evaluate once on open so new progress is reflected immediately.
  const [unlocks] = useState(() => {
    const { newly } = refreshAchievements(activities, profile);
    if (newly.length === 1) {
      onToast?.(t('toast.achievement.one', { name: t(newly[0].title) }));
    } else if (newly.length > 1) {
      onToast?.(t('toast.achievement.many', { count: newly.length }));
    }
    return loadUnlocks();
  });
  const unlockedN = Object.keys(unlocks.unlocked).length;
  const total = ACHIEVEMENTS.length;

  const byCategory = useMemo(() => {
    const map = new Map<AchievementCategory, AchievementDef[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const a of ACHIEVEMENTS) {
      map.get(a.category)?.push(a);
    }
    return map;
  }, []);

  return (
    <div className="screen achievements-screen">
      <button type="button" className="back" onClick={onBack}>
        ‹ {t('app.tab.profile')}
      </button>
      <h1>{t('achievements.title')}</h1>
      <p className="subtitle">
        {t('achievements.subtitle', { unlocked: unlockedN, total })}
      </p>

      <div className="achievement-progress-bar" aria-hidden>
        <span style={{ width: `${total ? (unlockedN / total) * 100 : 0}%` }} />
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const list = byCategory.get(cat) ?? [];
        if (list.length === 0) return null;
        const done = list.filter((a) => unlocks.unlocked[a.id]).length;
        return (
          <div className="card achievement-category" key={cat}>
            <div className="row" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>{t(ACHIEVEMENT_CATEGORY_LABEL[cat])}</h2>
              <span className="hint" style={{ margin: 0 }}>
                {done}/{list.length}
              </span>
            </div>
            <ul className="achievement-list">
              {list.map((a) => {
                const when = unlocks.unlocked[a.id];
                const unlocked = Boolean(when);
                return (
                  <li
                    key={a.id}
                    className={`achievement-row${unlocked ? ' unlocked' : ' locked'}`}
                  >
                    <span className="achievement-icon-wrap" aria-hidden>
                      <AchievementIcon id={a.icon} />
                    </span>
                    <span className="achievement-copy">
                      <strong>{t(a.title)}</strong>
                      <span className="achievement-desc">{t(a.description)}</span>
                      {unlocked && when ? (
                        <span className="achievement-date">
                          {t('achievement.unlockedOn', {
                            date: new Date(when).toLocaleDateString(tag),
                          })}
                        </span>
                      ) : (
                        <span className="achievement-date muted">{t('achievement.locked')}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
