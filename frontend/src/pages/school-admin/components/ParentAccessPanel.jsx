import { useId, useState } from 'react';
import { Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { LuHeart, LuSend, LuUserMinus, LuUserPlus } from 'react-icons/lu';
import { useApi } from '../../../hooks/useApi';
import { useMutation } from '../../../hooks/useMutation';
import { accountStatus, initials } from '../../../lib/format';
import EmptyState from '../../../components/ui/EmptyState';
import FormAlert from '../../../components/ui/FormAlert';
import StatusBadge from '../../../components/ui/StatusBadge';
import RowActions from '../../../components/ui/RowActions';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import ShareLinkDialog from '../../../components/ui/ShareLinkDialog';

const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Other'];

const splitName = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
};

/** Invites a parent; prefilled from the guardian details on the learner record. */
const InviteParentModal = ({ learner, onClose, onInvited }) => {
  const titleId = useId();
  const name = splitName(learner.guardian_name ?? '');
  const [form, setForm] = useState({
    email: learner.guardian_email ?? '',
    first_name: name.first,
    last_name: name.last,
    relationship: '',
  });
  const save = useMutation();
  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
    isInvalid: Boolean(save.fieldErrors[key]),
  });
  const error = (key) => <Form.Control.Feedback type="invalid">{save.fieldErrors[key]}</Form.Control.Feedback>;

  const submit = async (e) => {
    e.preventDefault();
    const result = await save.run('post', `/api/school-admin/learners/${learner.learner_id}/guardians`, form);
    if (result.ok) onInvited(result.data, result.message);
  };

  return (
    <Modal aria-labelledby={titleId} show onHide={onClose} centered backdrop={save.pending ? 'static' : true}>
      <Form onSubmit={submit} noValidate>
        <Modal.Header closeButton>
          <Modal.Title id={titleId} as="h2" className="h5 mb-0">
            Invite a parent to follow {learner.first_name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-body-secondary">
            They’ll get a link to set a password and can then see {learner.first_name}’s marks and teacher comments. If
            they already follow a brother or sister, use the same email and the child is added to their account.
          </p>
          <FormAlert variant="danger">{save.error}</FormAlert>
          <Row className="g-3">
            <Col xs={12}>
              <Form.Group controlId="parent-email">
                <Form.Label>Email address</Form.Label>
                <Form.Control {...field('email')} type="email" autoComplete="off" autoFocus required />
                {error('email')}
              </Form.Group>
            </Col>
            <Col sm={6}>
              <Form.Group controlId="parent-first">
                <Form.Label>First name</Form.Label>
                <Form.Control {...field('first_name')} autoComplete="off" />
                {error('first_name')}
              </Form.Group>
            </Col>
            <Col sm={6}>
              <Form.Group controlId="parent-last">
                <Form.Label>Last name</Form.Label>
                <Form.Control {...field('last_name')} autoComplete="off" />
                {error('last_name')}
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group controlId="parent-relationship">
                <Form.Label>
                  Relationship <span className="text-body-secondary fw-normal">(optional)</span>
                </Form.Label>
                <Form.Select {...field('relationship')}>
                  <option value="">Not specified</option>
                  {RELATIONSHIPS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.pending}>
            {save.pending && <Spinner size="sm" className="me-2" aria-hidden="true" />}
            Send invitation
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

/** Who can follow this learner in the parent portal. */
const ParentAccessPanel = ({ learner }) => {
  const base = `/api/school-admin/learners/${learner.learner_id}/guardians`;
  const { data, reload } = useApi(base);
  const guardians = data?.guardians ?? [];
  const [dialog, setDialog] = useState(null); // 'invite' | { remove }
  const [shareLink, setShareLink] = useState(null);
  const mutate = useMutation();

  const sendLink = async (guardian) => {
    const result = await mutate.run('post', `${base}/${guardian.user_id}/account-link`);
    if (result.ok) setShareLink({ link: result.data, person: guardian });
    else toast.error(result.message);
  };

  return (
    <section className="el-panel" aria-labelledby="parent-access-heading">
      <div className="el-panel__header">
        <div>
          <h2 id="parent-access-heading" className="el-panel__title">
            Parent portal
          </h2>
          <p className="el-panel__subtitle">Parents who can see {learner.first_name}’s marks.</p>
        </div>
        <Button size="sm" onClick={() => setDialog('invite')} className="d-inline-flex align-items-center gap-2">
          <LuUserPlus aria-hidden="true" /> Invite
        </Button>
      </div>
      {data && guardians.length === 0 ? (
        <EmptyState compact icon={LuHeart} title="No parent invited yet">
          Invite a parent so they can follow {learner.first_name}’s progress from their phone.
        </EmptyState>
      ) : (
        <ul className="el-list">
          {guardians.map((g) => {
            const state = accountStatus(g);
            return (
              <li key={g.user_id}>
                <div className="el-person">
                  <span className="el-avatar el-avatar--sm" aria-hidden="true">
                    {initials(g.first_name, g.last_name)}
                  </span>
                  <div className="el-person__text">
                    <div className="el-cell-primary">
                      {g.first_name} {g.last_name}
                      {g.relationship && <span className="el-cell-secondary fw-normal"> · {g.relationship}</span>}
                    </div>
                    <div className="el-cell-secondary text-truncate">{g.email}</div>
                  </div>
                </div>
                <span className="d-flex align-items-center gap-2 flex-shrink-0">
                  <StatusBadge status={state} />
                  <RowActions
                    label={`Actions for ${g.first_name} ${g.last_name}`}
                    items={[
                      {
                        label: state === 'pending' ? 'Resend invitation' : 'Send password reset link',
                        icon: LuSend,
                        onClick: () => sendLink(g),
                        hidden: !g.is_active,
                      },
                      null,
                      { label: 'Remove access', icon: LuUserMinus, danger: true, onClick: () => setDialog({ remove: g }) },
                    ]}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {dialog === 'invite' && (
        <InviteParentModal
          learner={learner}
          onClose={() => setDialog(null)}
          onInvited={({ guardian, invite }, message) => {
            setDialog(null);
            if (invite) setShareLink({ link: { ...invite, kind: 'invite' }, person: guardian });
            else toast.success(message);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        show={Boolean(dialog?.remove)}
        title={dialog?.remove && `Remove ${dialog.remove.first_name}’s access?`}
        confirmLabel="Remove access"
        onConfirm={async () => {
          const result = await mutate.run('delete', `${base}/${dialog.remove.user_id}`);
          if (result.ok) {
            toast.success(result.message);
            reload();
          }
          return result;
        }}
        onClose={() => setDialog(null)}
      >
        They’ll no longer see {learner.first_name}’s marks. If {learner.first_name} was their only child at Edulens, their
        account is switched off.
      </ConfirmDialog>

      <ShareLinkDialog link={shareLink?.link} person={shareLink?.person} onClose={() => setShareLink(null)} />
    </section>
  );
};

export default ParentAccessPanel;
