import Image from 'next/image';
import { formatDuration } from '@/lib/format';

/**
 * 16:9 thumbnail with the duration badge from the design. When no thumbnail URL
 * exists (demo mode, or a video YouTube has not returned art for) the design's
 * gradient placeholder is used rather than an empty box.
 */
export function Thumbnail({
  url,
  title,
  durationSeconds,
  className = '',
  sizes = '284px',
  muted = false,
  showDuration = true,
  showLabel = true,
}: {
  url: string | null;
  title: string;
  durationSeconds: number | null;
  className?: string;
  sizes?: string;
  muted?: boolean;
  showDuration?: boolean;
  /** The "THUMBNAIL 16:9" placeholder caption; hide it in narrow contexts. */
  showLabel?: boolean;
}) {
  return (
    <div
      className={`relative aspect-video overflow-hidden ${
        url ? 'bg-panel-alt' : muted ? 'thumb-placeholder-muted' : 'thumb-placeholder'
      } ${className}`}
    >
      {url ? (
        <Image src={url} alt={title} fill sizes={sizes} className="object-cover" unoptimized={false} />
      ) : showLabel ? (
        <span className="metric-label absolute bottom-2.5 start-3 text-[9.5px] text-dim">
          THUMBNAIL 16:9
        </span>
      ) : null}
      {showDuration && durationSeconds ? (
        <span className="num absolute bottom-2.5 end-3 rounded-[3px] bg-black/60 px-1.5 py-1 text-[10px] leading-none font-medium text-fg-4">
          {formatDuration(durationSeconds)}
        </span>
      ) : null}
    </div>
  );
}
