import { useId, useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { LuCheck, LuCopy, LuMail, LuMessageCircle, LuTriangleAlert } from 'react-icons/lu';

/**
 * Shows an invitation or password-reset link after it's issued, with copy and
 * WhatsApp share buttons, and says whether it was also emailed.
 *
 * link: { link, emailSent, expiresIn, kind: 'invite' | 'reset' } | null
 */
const ShareLinkDialog = ({ link, person, onClose }) => {
  const titleId = useId();
  const [copied, setCopied] = useState(false);
  if (!link) return null;

  const isInvite = link.kind !== 'reset';
  const message = isInvite
    ? `Hi ${person?.first_name ?? ''}, you’ve been invited to Edulens LMS. Set up your account here (expires in ${link.expiresIn}): ${link.link}`
    : `Hi ${person?.first_name ?? ''}, use this link to choose a new Edulens LMS password (expires in ${link.expiresIn}): ${link.link}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const close = () => {
    setCopied(false);
    onClose();
  };

  return (
    <Modal aria-labelledby={titleId} show onHide={close} centered>
      <Modal.Header closeButton>
        <Modal.Title id={titleId} as="h2" className="h5 mb-0">
          {isInvite ? 'Invitation ready' : 'Reset link ready'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className={`el-form-alert el-form-alert--${link.emailSent ? 'success' : 'info'}`} role="status">
          {link.emailSent ? (
            <LuMail size={18} className="flex-shrink-0 mt-1" aria-hidden="true" />
          ) : (
            <LuTriangleAlert size={18} className="flex-shrink-0 mt-1" aria-hidden="true" />
          )}
          <div>
            {link.emailSent
              ? `We emailed this link to ${person?.email}.`
              : 'Email isn’t set up on this server, so share this link yourself.'}{' '}
            It works once and expires in {link.expiresIn}.
          </div>
        </div>

        <label className="form-label" htmlFor="share-link-input">
          {isInvite ? 'Invitation link' : 'Reset link'}
          {person && ` for ${person.first_name} ${person.last_name}`}
        </label>
        <div className="input-group">
          <input
            id="share-link-input"
            className="form-control font-monospace small"
            value={link.link}
            readOnly
            onFocus={(e) => e.target.select()}
          />
          <Button variant="primary" onClick={copy} aria-live="polite">
            {copied ? <LuCheck aria-hidden="true" /> : <LuCopy aria-hidden="true" />}
            <span className="ms-2">{copied ? 'Copied' : 'Copy'}</span>
          </Button>
        </div>
      </Modal.Body>
      <Modal.Footer className="justify-content-between">
        <a
          className="btn btn-light d-inline-flex align-items-center gap-2"
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
        >
          <LuMessageCircle aria-hidden="true" /> Share on WhatsApp
        </a>
        <Button variant="primary" onClick={close}>
          Done
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ShareLinkDialog;
