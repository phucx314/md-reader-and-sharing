type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open, title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger, onConfirm, onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="actions">
          <button className="secondary" onClick={onCancel}>{cancelText}</button>
          <button className={danger ? 'danger' : ''} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
