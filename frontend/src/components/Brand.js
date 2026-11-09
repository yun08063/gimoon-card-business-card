import Icon from "@/components/Icon";

export function GimoonBrand({
  href = "/",
  onClick,
  className = "",
  compact = false,
  light = false,
}) {
  const content = (
    <>
      <Icon
        name="link"
        size={compact ? 10 : 18}
        className={light ? "text-[#8790ff]" : "text-[#5865f2]"}
      />
      <span>{"gimoon"}</span>
    </>
  );
  const classes = `inline-flex w-fit items-center gap-1.5 font-bold tracking-[-.05em] ${compact ? "text-[9px]" : "text-base"} ${light ? "text-white" : "text-slate-800"} ${className}`;

  return href ? (
    <a href={href} onClick={onClick} className={classes}>
      {content}
    </a>
  ) : (
    <span className={classes}>{content}</span>
  );
}

export function PageFooter({
  compact = false,
  interactive = true,
  onNavigate,
}) {
  const callToAction = (
    <span
      className={`inline-flex items-center gap-1.5 font-medium ${compact ? "text-[6px]" : "text-[11px] sm:text-xs"} text-slate-500`}
    >
      나만의 스마트 링크 만들기
      <Icon name="arrow" size={compact ? 7 : 13} />
    </span>
  );
  const content = (
    <div
      className={`mx-auto flex w-full max-w-6xl items-center justify-between gap-2 ${compact ? "min-h-8 px-2 py-1 text-[6px]" : "min-h-14 px-5 py-3 text-xs sm:px-8"}`}
    >
      <GimoonBrand
        href={interactive ? "/" : null}
        onClick={onNavigate ? (event) => onNavigate(event, "/") : undefined}
        compact={compact}
        className={compact ? "gap-1" : "gap-2"}
      />
      {interactive ? (
        <a
          href="/"
          onClick={onNavigate ? (event) => onNavigate(event, "/") : undefined}
          className="transition hover:text-[#5865f2]"
        >
          {callToAction}
        </a>
      ) : (
        callToAction
      )}
    </div>
  );

  if (!interactive)
    return (
      <div className="w-full shrink-0 border-t border-slate-200 bg-white">
        {content}
      </div>
    );

  return (
    <footer className="w-full shrink-0 border-t border-slate-200 bg-white">
      {content}
    </footer>
  );
}
