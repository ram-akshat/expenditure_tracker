import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage';
import {
  LayoutDashboard,
  ArrowLeftRight,
  ChartNoAxesCombined,
  Target,
  Tags,
  Plus,
  Download,
  Leaf,
  ArrowUpRight,
  Menu,
  X,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { useResource } from './hooks/useResource';
import { browserStorage, exportCsv } from './services/api';
import { EntryForm, DeleteDialog } from './components/Forms';
import { today, monthLabel } from './components/Common';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import Categories from './pages/Categories';

const navigation = [
  ['Overview', LayoutDashboard],
  ['Transactions', ArrowLeftRight],
  ['Budgets', Target],
  ['Analytics', ChartNoAxesCombined],
  ['Categories', Tags],
];
const descriptions = {
  Overview: 'A little clarity for your everyday money.',
  Transactions: 'Keep track of the little things. And the big ones.',
  Budgets: 'A thoughtful plan for the month ahead.',
  Analytics: 'See the patterns behind your spending.',
  Categories: 'Keep your financial world in order.',
};
function AppShell({ studentName }) {
  const [page, setPage] = useState('Overview');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [notice, setNotice] = useState('');
  const [menu, setMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const categories = useResource('/categories', revision);
  const user = useResource('/user');
  const add = (kind) => setModal({ kind });
  const navigate = (value) => {
    setPage(value);
    setMenu(false);
  };
  const saved = (message) => {
    setModal(null);
    setDeleting(null);
    setRevision((value) => value + 1);
    setNotice(message);
  };
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const download = async () => {
    setExporting(true);
    try {
      await exportCsv({ month });
    } catch (error) {
      setNotice(error.message);
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="app-shell">
      {menu && <div className="sidebar-overlay" onClick={() => setMenu(false)} />}
      <aside className={`sidebar ${menu ? 'is-open' : ''}`}>
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            navigate('Overview');
          }}
        >
          <span className="brand-symbol">
            <Leaf size={23} strokeWidth={1.8} />
          </span>
          spendwise<span className="brand-period">.</span>
        </a>
        <span className="nav-caption">YOUR WORKSPACE</span>
        <nav aria-label="Main navigation">
          {navigation.map(([name, Icon]) => (
            <button
              key={name}
              className={page === name ? 'active' : ''}
              onClick={() => navigate(name)}
              aria-current={page === name ? 'page' : undefined}
            >
              <Icon size={19} />
              <span>{name}</span>
              {page === name && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-spark">✳</span>
            <h3>Good habits grow.</h3>
            <p>
              A little awareness today.
              <br />A little more freedom tomorrow.
            </p>
            <button onClick={() => navigate('Budgets')}>
              Plan your month <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="profile">
            <span className="avatar">{(studentName || user.data?.name || 'S').slice(0, 1)}</span>
            <div>
              <strong>{studentName || user.data?.name || 'Your workspace'}</strong>
              <span>Personal account</span>
            </div>
            <span className="profile-dot" title="Single-user workspace" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span>My workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{page}</strong>
          </div>
          <span className="topbar-note">
            <span /> A little more mindful, every day
          </span>
        </header>
        <main id="main-content">
          {browserStorage && (
            <div className="storage-notice" role="note">
              Saved only in this browser, under your BT ID. Use CSV export for backups. Clearing
              site data removes saved records.
            </div>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR MONEY, IN FOCUS</span>
              <h1>{page === 'Overview' ? 'Financial overview' : page}</h1>
              <p>{descriptions[page]}</p>
            </div>
            <div className="page-actions">
              <label className="month-picker">
                <span className="visually-hidden">Select month</span>
                <input
                  type="month"
                  required
                  min="1900-01"
                  max="2100-12"
                  value={month}
                  onChange={(event) => {
                    if (/^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(event.target.value))
                      setMonth(event.target.value);
                  }}
                />
              </label>
              <button
                className="btn btn-primary"
                onClick={() =>
                  add(
                    page === 'Budgets'
                      ? 'budget'
                      : page === 'Categories'
                        ? 'category'
                        : 'transaction',
                  )
                }
                disabled={!categories.data}
              >
                <Plus size={17} />
                Add{' '}
                {page === 'Budgets' ? 'budget' : page === 'Categories' ? 'category' : 'transaction'}
              </button>
            </div>
          </div>
          {categories.error ? (
            <div className="alert alert-danger" role="alert">
              <strong>Couldn’t connect to your workspace.</strong>
              <p className="mb-2">{categories.error}</p>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => setRevision((value) => value + 1)}
              >
                <RefreshCw size={14} /> Try again
              </button>
            </div>
          ) : (
            <>
              {(page === 'Overview' || page === 'Analytics') && (
                <Dashboard
                  month={month}
                  revision={revision}
                  add={add}
                  navigate={navigate}
                  analytics={page === 'Analytics'}
                />
              )}
              {page === 'Transactions' && (
                <Transactions
                  key={month}
                  month={month}
                  revision={revision}
                  categories={categories.data || []}
                  edit={(entry) => setModal({ kind: 'transaction', entry })}
                  remove={(entry) => setDeleting({ kind: 'transaction', entry })}
                  notify={setNotice}
                />
              )}
              {page === 'Budgets' && (
                <Budgets
                  month={month}
                  revision={revision}
                  add={add}
                  edit={(entry) => setModal({ kind: 'budget', entry })}
                  remove={(entry) => setDeleting({ kind: 'budget', entry })}
                />
              )}
              {page === 'Categories' &&
                (categories.loading ? (
                  <p role="status">Loading categories…</p>
                ) : (
                  <Categories categories={categories.data || []} add={add} />
                ))}
            </>
          )}
          <footer className="page-footer">
            <span>Made for a more mindful relationship with money.</span>
            <button className="text-button" onClick={download} disabled={exporting}>
              <Download size={14} />
              {exporting ? 'Exporting…' : `Export ${monthLabel(month)}`}
            </button>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="notice" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <EntryForm
          key={`${modal.kind}-${modal.entry?.transaction_id || modal.entry?.budget_id || 'new'}`}
          {...modal}
          month={month}
          categories={categories.data || []}
          close={() => setModal(null)}
          saved={saved}
        />
      )}
      {deleting && <DeleteDialog target={deleting} close={() => setDeleting(null)} saved={saved} />}
    </div>
  );
}

export default function App() {
  const [studentName, setStudentName] = useState(
    () => sessionStorage.getItem('student_name') || '',
  );
  if (!studentName) {
    return <LoginPage onLogin={setStudentName} />;
  }
  return <AppShell studentName={studentName} />;
}
