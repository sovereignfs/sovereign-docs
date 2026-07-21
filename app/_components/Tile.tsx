import Link from 'next/link';
import { Card } from '@sovereignfs/ui';
import styles from './Tile.module.css';

interface TileProps {
  href: string;
  label: string;
  badge?: string;
}

/**
 * A Drive-style clickable card for a project or document (D-09). No icon —
 * `@sovereignfs/ui`'s curated Icon set has no folder/document glyph yet, and
 * per the ledger precedent (see its EmptyState) an unrelated icon is worse
 * than none. Add one to the design system when a screen actually needs it.
 */
export function Tile({ href, label, badge }: TileProps) {
  return (
    <Link href={href} className={styles.link}>
      <Card as="article" interactive padding="md" className={styles.card}>
        <span className={styles.label}>{label}</span>
        {badge ? <span className={styles.badge}>{badge}</span> : null}
      </Card>
    </Link>
  );
}
