import { useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { LuArrowRight, LuHeartHandshake, LuPresentation, LuSchool, LuSparkles } from 'react-icons/lu';
import { useAuth } from '../../contexts/useAuth';
import { useApi } from '../../hooks/useApi';
import { ROLE_LABELS } from '../../config/navigation';

const ICONS = { school_admin: LuSchool, teacher: LuPresentation, parent: LuHeartHandshake };

/**
 * One-click sign-in to the demo school, shown above the sign-in form when the
 * server has DEMO_LOGIN=true. Renders nothing otherwise.
 */
const DemoSignIn = ({ onError }) => {
  const { demoLogin } = useAuth();
  const { data } = useApi('/api/auth/demo');
  const [pending, setPending] = useState(null);

  if (!data?.enabled || !data.accounts?.length) return null;

  const choose = async (key) => {
    setPending(key);
    onError(null);
    // On success PublicOnlyRoute moves on to the dashboard.
    const result = await demoLogin(key);
    if (!result.ok) {
      onError(result.message);
      setPending(null);
    }
  };

  return (
    <>
      <section className="el-demo" aria-labelledby="demo-heading">
        <h2 id="demo-heading" className="el-demo__title">
          <LuSparkles aria-hidden="true" /> Explore the demo
        </h2>
        <p className="el-demo__lede">No account needed. Pick a role to look around Sunflower Primary (Demo).</p>
        <div className="el-demo__options">
          {data.accounts.map((account) => {
            const Icon = ICONS[account.role] ?? LuSparkles;
            const busy = pending === account.key;
            const role = ROLE_LABELS[account.role] ?? account.role;
            const descriptionId = `demo-${account.key}-desc`;
            return (
              <button
                key={account.key}
                type="button"
                className="el-demo__option"
                onClick={() => choose(account.key)}
                disabled={pending !== null}
                aria-busy={busy}
                aria-label={`Sign in as the demo ${role.toLowerCase()}, ${account.name}`}
                aria-describedby={descriptionId}
              >
                <span className="el-demo__icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span className="el-demo__text">
                  <span className="el-demo__role">
                    {role}
                    <span className="el-demo__name"> · {account.name}</span>
                  </span>
                  <span className="el-demo__desc" id={descriptionId}>
                    {account.description}
                  </span>
                </span>
                {busy ? (
                  <Spinner size="sm" className="el-demo__go" aria-label="Signing in" />
                ) : (
                  <LuArrowRight className="el-demo__go" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </section>
      <div className="el-auth__divider">
        <span>or sign in with your school account</span>
      </div>
    </>
  );
};

export default DemoSignIn;
