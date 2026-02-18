type NoticeTone = 'error' | 'success' | 'warning';

export function Notice({
  tone,
  message,
  withMargin = false,
  onClose
}: {
  tone: NoticeTone;
  message: string;
  withMargin?: boolean;
  onClose?: () => void;
}) {
  if (!message) {
    return null;
  }

  const palette: Record<NoticeTone, { background: string; color: string }> = {
    error: { background: '#fee', color: '#900' },
    success: { background: '#ecfdf3', color: '#166534' },
    warning: { background: '#fff4e5', color: '#8a5300' }
  };

  return (
    <div
      style={{
        background: palette[tone].background,
        color: palette[tone].color,
        padding: 10,
        borderRadius: 6,
        marginBottom: withMargin ? 12 : 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8
      }}
      role="status"
      aria-live="polite"
    >
      <span style={{ flex: 1 }}>{message}</span>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar mensaje"
          style={{
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: 0
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
