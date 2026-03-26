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
    error: { background: '#FCEBEB', color: '#E24B4A' },
    success: { background: '#EFF8F5', color: '#0D5C44' },
    warning: { background: '#FAEEDA', color: '#BA7517' }
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
