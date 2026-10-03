import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { Patient, Sex } from '../../lib/types';
import { usePageTitle } from '../../lib/usePageTitle';

interface PatientRow extends Patient {
  _id: string;
  createdAt?: string;
}

const EMPTY_FORM = { name: '', sex: 'male' as Sex, birthYear: '', notes: '' };

export function Patients() {
  usePageTitle('Patients');
  const toast = useToast();

  const [patients, setPatients] = useState<PatientRow[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PatientRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PatientRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ patients: PatientRow[] }>('/patients');
      setPatients(data.patients);
    } catch {
      setPatients([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (p: PatientRow) => {
    setEditing(p);
    setForm({
      name: p.name,
      sex: p.sex,
      birthYear: p.birthYear ? String(p.birthYear) : '',
      notes: p.notes ?? '',
    });
    setError('');
    setModalOpen(true);
  };

  const save = async () => {
    setError('');
    const birthYear = Number(form.birthYear);
    if (!form.name.trim()) return setError('Name is required.');
    if (!form.birthYear.trim() || !Number.isInteger(birthYear) || birthYear < 1900 || birthYear > new Date().getFullYear()) {
      return setError('Enter a valid birth year (used to compute age for reports).');
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sex: form.sex,
        birthYear,
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      };
      if (editing) {
        await api.patch(`/patients/${editing._id}`, payload);
        toast.success('Patient profile updated.');
      } else {
        await api.post('/patients', payload);
        toast.success('Patient profile created.');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/patients/${deleteTarget._id}`);
      toast.success('Patient profile deleted. Existing reports keep their snapshot.');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Patient profiles"
        description="Store patient basics once and reuse them across reports. Age is computed from the birth year at each report's date."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            New patient
          </Button>
        }
      />

      {patients === null ? (
        <SkeletonRows rows={4} />
      ) : patients.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No patient profiles yet"
          description="Create a profile to speed up report entry — you can also use one-off entry without profiles."
          action={
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Create first profile
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {patients.map((p) => (
            <Card key={p._id}>
              <CardBody className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{p.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {p.sex} {p.birthYear ? `· born ${p.birthYear}` : ''}
                    {p.createdAt ? ` · added ${formatDate(p.createdAt)}` : ''}
                  </p>
                  {p.notes ? (
                    <p className="mt-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{p.notes}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button variant="ghost" size="sm" aria-label={`Edit ${p.name}`} onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => setDeleteTarget(p)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-5">
        <Alert kind="info" title="Privacy note">
          Only store what you need: a display name, sex and birth year. Reports keep an independent snapshot, so
          deleting a profile never corrupts historical reports.
        </Alert>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit patient profile' : 'New patient profile'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={save}>
              {editing ? 'Save changes' : 'Create profile'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <Alert kind="error">{error}</Alert> : null}
          <Input
            label="Display name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Demo Patient A"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Sex" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value as Sex })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other / prefer not to say</option>
            </Select>
            <Input
              label="Birth year"
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              value={form.birthYear}
              onChange={(e) => setForm({ ...form, birthYear: e.target.value })}
              hint="Used to compute age per report."
            />
          </div>
          <Input
            label="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Anything helpful to remember (never used for prediction)"
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={doDelete}>
              Delete profile
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-300">
          This removes the profile. Existing reports are kept (they carry their own patient snapshot).
        </p>
      </Modal>
    </div>
  );
}
