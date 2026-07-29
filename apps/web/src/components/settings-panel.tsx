'use client';

import { nextRotationTarget, type Rotation } from '@flare/core/reminders';
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { Fragment, useEffect, useState, type ReactNode } from 'react';

import { PrivacyMarkdown } from '../../../mobile/src/constants/privacy';
import { TermsMarkdown } from '../../../mobile/src/constants/terms';
import { auth, db, googleProvider } from '@/lib/firebase';
import { paletteById, spacePalettes, type SpacePalette } from '@/lib/palettes';

const inviteLifetime = 7 * 24 * 60 * 60 * 1000;
const inviteAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const destructive = '#FF6467';

export type SettingsSpace = {
  id: string;
  kind: 'personal' | 'shared';
  name: string;
  memberIds: string[];
  members: Record<string, { name: string; expoPushToken?: string }>;
  inviteCode: string | null;
  inviteCodeExpiresAt: number | null;
  archived: boolean;
  palette: string;
};

type SettingsMember = { uid: string; index: number; name: string };

type SettingsPanelProps = {
  user: User;
  profileName: string;
  space: SettingsSpace | null;
  spaces: SettingsSpace[];
  members: SettingsMember[];
  palette: SpacePalette;
  workerUrl: string;
  onCreateSpace: () => void;
  onJoinSpace: () => void;
  onSelectSpace: (id: string) => void;
  onNotice: (message: string) => void;
};

function generateInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => inviteAlphabet[byte % inviteAlphabet.length]).join('');
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function SettingsPanel({
  user,
  profileName,
  space,
  spaces,
  members,
  palette,
  workerUrl,
  onCreateSpace,
  onJoinSpace,
  onSelectSpace,
  onNotice,
}: SettingsPanelProps) {
  const [ownName, setOwnName] = useState(profileName);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [dialog, setDialog] = useState<'spaces' | 'signout' | 'leave' | 'delete' | 'terms' | 'privacy' | null>(null);
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDestructiveBusy, setIsDestructiveBusy] = useState(false);

  useEffect(() => setOwnName(profileName), [profileName]);

  const isGoogleAccount = user.providerData.some((provider) => provider.providerId === 'google.com');
  const isShared = space?.kind === 'shared';
  const isFull = (space?.memberIds.length ?? 0) >= 8;
  const isKeyExpired =
    space?.inviteCodeExpiresAt != null && Date.now() > space.inviteCodeExpiresAt;
  const daysUntilExpiry =
    space?.inviteCodeExpiresAt != null
      ? Math.ceil((space.inviteCodeExpiresAt - Date.now()) / (24 * 60 * 60 * 1000))
      : null;
  const hasNameChanged = ownName.trim().length > 0 && ownName.trim() !== profileName;

  const saveName = async () => {
    if (!hasNameChanged) return;
    setIsSavingName(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { displayName: ownName.trim() });
      onNotice('Nombre actualizado.');
    } catch {
      onNotice('No se ha podido guardar el nombre.');
    } finally {
      setIsSavingName(false);
    }
  };

  const choosePalette = async (id: string) => {
    if (!space || id === space.palette) return;
    try {
      await updateDoc(doc(db, 'spaces', space.id), { palette: id });
    } catch {
      onNotice('No se han podido cambiar los colores.');
    }
  };

  const regenerateKey = async () => {
    if (!space || space.kind !== 'shared') return;
    setIsRegenerating(true);
    try {
      const code = generateInviteCode();
      const expiresAt = Date.now() + inviteLifetime;
      await setDoc(doc(db, 'invites', code), {
        spaceId: space.id,
        createdAt: Date.now(),
        expiresAt: Timestamp.fromMillis(expiresAt),
      });
      await updateDoc(doc(db, 'spaces', space.id), {
        inviteCode: code,
        inviteCodeExpiresAt: expiresAt,
      });
      onNotice('Nueva llave generada.');
    } catch {
      onNotice('No se ha podido generar una llave nueva.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const sendDeparturePush = async (target: SettingsSpace, recipientUid: string) => {
    const token = await user.getIdToken();
    await fetch(`${workerUrl}/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        spaceId: target.id,
        recipientUid,
        title: target.name,
        message: `${profileName} ha salido del espacio`,
      }),
    });
  };

  const dissolveSpace = async (target: SettingsSpace) => {
    if (target.inviteCode) {
      await deleteDoc(doc(db, 'invites', target.inviteCode)).catch(() => undefined);
    }
    for (const collectionName of ['reminders', 'photos', 'messages']) {
      const entries = await getDocs(collection(db, 'spaces', target.id, collectionName));
      await Promise.all(entries.docs.map((entry) => deleteDoc(entry.ref)));
    }
    await deleteDoc(doc(db, 'spaces', target.id));
  };

  const withdrawFrom = async (target: SettingsSpace) => {
    if (target.memberIds.length <= 1) {
      await dissolveSpace(target);
      return;
    }

    const remainingUids = target.memberIds.filter((uid) => uid !== user.uid);
    const reminderDocs = await getDocs(collection(db, 'spaces', target.id, 'reminders'));
    await Promise.all(
      reminderDocs.docs.map(async (entry) => {
        const data = entry.data();
        if (data.status !== 'pending') return;
        const currentTargets = data.targetUids as string[] | undefined;
        if (!currentTargets?.includes(user.uid)) return;

        const retained = currentTargets.filter(
          (uid) => uid !== user.uid && remainingUids.includes(uid),
        );
        if (retained.length > 0) {
          await updateDoc(entry.ref, { targetUids: retained });
          return;
        }

        const rotation = data.rotation as Rotation | null | undefined;
        const rotated = rotation
          ? nextRotationTarget(rotation, currentTargets, remainingUids)
          : null;
        const creatorUid = data.createdByUid as string | undefined;
        const fallback =
          rotated ??
          (creatorUid && remainingUids.includes(creatorUid) ? creatorUid : remainingUids[0]);
        await updateDoc(entry.ref, { targetUids: [fallback] });
      }),
    );

    await Promise.all(
      remainingUids.map((uid) => sendDeparturePush(target, uid).catch(() => undefined)),
    );
    await updateDoc(doc(db, 'spaces', target.id), {
      memberIds: remainingUids,
      [`members.${user.uid}`]: deleteField(),
    });
  };

  const leaveCurrentSpace = async () => {
    if (!space || space.kind !== 'shared') return;
    setIsDestructiveBusy(true);
    try {
      await withdrawFrom(space);
      onSelectSpace(`personal_${user.uid}`);
      setDialog(null);
      onNotice('Has salido del espacio.');
    } catch {
      onNotice('No se ha podido salir. Inténtalo de nuevo.');
    } finally {
      setIsDestructiveBusy(false);
    }
  };

  const closeDeleteDialog = () => {
    if (isDestructiveBusy) return;
    setDialog(null);
    setPassword('');
    setDeleteError('');
  };

  const deleteAccount = async () => {
    setDeleteError('');
    setIsDestructiveBusy(true);
    try {
      if (isGoogleAccount) {
        await reauthenticateWithPopup(user, googleProvider);
      } else {
        const credential = EmailAuthProvider.credential(user.email ?? '', password);
        await reauthenticateWithCredential(user, credential);
      }

      for (const target of spaces) {
        if (target.kind === 'personal') await dissolveSpace(target);
        else await withdrawFrom(target);
      }
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
    } catch (caught) {
      const code =
        caught instanceof Error && 'code' in caught
          ? String((caught as Error & { code: string }).code)
          : '';
      setDeleteError(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          ? 'La contraseña no es correcta.'
          : code === 'auth/popup-closed-by-user'
            ? 'Hay que confirmar con Google para poder borrarla.'
            : 'No se ha podido borrar. Inténtalo de nuevo.',
      );
      setIsDestructiveBusy(false);
    }
  };

  return (
    <section className="settings-view">
      <div className="section-heading settings-heading">
        <div>
          <p className="eyebrow">TU CUENTA Y TUS ESPACIOS</p>
          <h2>Ajustes</h2>
        </div>
      </div>

      <div className="settings-stack">
        <article className="settings-card panel">
          <p className="eyebrow">
            {space?.kind === 'personal' ? 'TU ESPACIO PERSONAL' : space?.name.toUpperCase()}
          </p>
          <div className="settings-member-list">
            {members.map((member) => {
              const color = palette.lights[member.index] ?? '#6B7280';
              const isMe = member.uid === user.uid;
              return (
                <div className="settings-member" key={member.uid}>
                  <i style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}66` }} />
                  <span className="settings-member-avatar">{initials(member.name)}</span>
                  <span>
                    <strong>{isMe ? profileName : member.name}</strong>
                    <small>{isMe ? user.email ?? '—' : 'Dentro del espacio'}</small>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="settings-actions">
            <button className="quiet-button dynamic-border" type="button" onClick={onCreateSpace}>
              Crear un espacio
            </button>
            <button className="quiet-button" type="button" onClick={() => setDialog('spaces')}>
              Gestionar espacios
            </button>
            <button className="quiet-button" type="button" onClick={onJoinSpace}>
              Entrar con una llave
            </button>
          </div>
        </article>

        <article className="settings-card panel">
          <label className="eyebrow" htmlFor="settings-name">CÓMO TE LLAMAS</label>
          <div className="settings-name-row">
            <input
              id="settings-name"
              value={ownName}
              onChange={(event) => setOwnName(event.target.value)}
              maxLength={20}
              placeholder="Tu nombre"
            />
            {hasNameChanged && (
              <button className="quiet-button dynamic-border" type="button" disabled={isSavingName} onClick={saveName}>
                {isSavingName ? 'Guardando…' : 'Guardar'}
              </button>
            )}
          </div>
        </article>

        <article className="settings-card panel">
          <p className="eyebrow">COLORES DEL ESPACIO</p>
          <div className="palette-grid" role="radiogroup" aria-label="Paleta del espacio">
            {spacePalettes.map((option) => (
              <button
                className={option.id === space?.palette ? 'palette-option selected' : 'palette-option'}
                style={{ '--palette-lens': option.lens } as React.CSSProperties}
                type="button"
                role="radio"
                aria-checked={option.id === space?.palette}
                onClick={() => choosePalette(option.id)}
                key={option.id}>
                <span>
                  {option.lights.slice(0, 4).map((color) => (
                    <i style={{ backgroundColor: color }} key={color} />
                  ))}
                </span>
                <small>{option.id}</small>
              </button>
            ))}
          </div>
        </article>

        {isShared && space?.inviteCode && (
          <article className={`settings-card panel key-settings ${isKeyExpired ? 'danger-card' : ''}`}>
            <p className="eyebrow">LA LLAVE</p>
            {isFull ? (
              <p className="settings-copy">El espacio está completo — no hace falta llave para nadie más.</p>
            ) : (
              <>
                <button
                  className="settings-key"
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(space.inviteCode ?? '');
                    onNotice('Llave copiada.');
                  }}>
                  {space.inviteCode}
                </button>
                <p className={isKeyExpired ? 'settings-copy destructive-text' : 'settings-copy'}>
                  {isKeyExpired
                    ? 'Ha caducado — nadie puede entrar ya con ella.'
                    : daysUntilExpiry !== null && daysUntilExpiry <= 1
                      ? 'Caduca hoy.'
                      : `Caduca en ${daysUntilExpiry} días.`}
                </p>
                <button className="quiet-button" type="button" disabled={isRegenerating} onClick={regenerateKey}>
                  {isRegenerating ? 'Generando…' : 'Generar nueva llave'}
                </button>
              </>
            )}
          </article>
        )}

        <div className="settings-legal">
          <p className="eyebrow">LEGAL</p>
          <button type="button" onClick={() => setDialog('terms')}>Términos de uso</button>
          <button type="button" onClick={() => setDialog('privacy')}>Política de Privacidad</button>
        </div>

        <button className="quiet-button settings-signout" type="button" onClick={() => setDialog('signout')}>
          Cerrar sesión
        </button>

        <article className="settings-card panel danger-card">
          <p className="eyebrow destructive-text">ZONA DE PELIGRO</p>
          {isShared && (
            <div className="danger-action">
              <strong>Salir de este espacio</strong>
              <p>Perderás el acceso a este espacio.</p>
              <button type="button" onClick={() => setDialog('leave')}>Salir de este espacio</button>
            </div>
          )}
          <div className={`danger-action ${isShared ? 'separated' : ''}`}>
            <strong>Eliminar mi cuenta</strong>
            <p>Esta acción no se puede deshacer.</p>
            <button type="button" onClick={() => setDialog('delete')}>Eliminar mi cuenta</button>
          </div>
        </article>
      </div>

      {dialog === 'spaces' && (
        <SettingsDialog title="Gestionar espacios" onClose={() => setDialog(null)}>
          <div className="managed-spaces">
            {spaces.map((entry) => {
              const entryPalette = paletteById(entry.palette);
              return (
                <div className={entry.archived ? 'managed-space archived' : 'managed-space'} key={entry.id}>
                  <span className="managed-space-lights">
                    {entry.memberIds.map((uid, index) => (
                      <i style={{ background: entryPalette.lights[index] }} key={uid} />
                    ))}
                  </span>
                  <span>
                    <strong>{entry.kind === 'personal' ? 'Personal' : entry.name}</strong>
                    <small>{entry.archived ? 'Archivado' : `${entry.memberIds.length} ${entry.memberIds.length === 1 ? 'persona' : 'personas'}`}</small>
                  </span>
                  <span className="managed-space-actions">
                    {!entry.archived && (
                      <button type="button" onClick={() => { onSelectSpace(entry.id); setDialog(null); }}>
                        Abrir
                      </button>
                    )}
                    {entry.kind === 'shared' && (
                      <button
                        type="button"
                        onClick={() =>
                          updateDoc(doc(db, 'spaces', entry.id), { archived: !entry.archived })
                            .catch(() => onNotice('No se ha podido actualizar el espacio.'))
                        }>
                        {entry.archived ? 'Desarchivar' : 'Archivar'}
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </SettingsDialog>
      )}

      {dialog === 'signout' && (
        <SettingsDialog title="¿Cerrar sesión?" onClose={() => setDialog(null)}>
          <p className="settings-copy">Puedes volver cuando quieras.</p>
          <div className="dialog-actions">
            <button className="quiet-button" type="button" onClick={() => setDialog(null)}>Quedarme</button>
            <button className="danger-button" type="button" onClick={() => signOut(auth)}>Salir</button>
          </div>
        </SettingsDialog>
      )}

      {dialog === 'leave' && space && (
        <SettingsDialog title="¿Salir de este espacio?" onClose={() => !isDestructiveBusy && setDialog(null)}>
          <p className="settings-copy">
            {space.memberIds.length === 1
              ? 'Al ser el único miembro, el espacio se elimina. Tu cuenta no se ve afectada.'
              : 'Seguirá para los demás. Necesitarás una llave nueva para volver a entrar.'}
          </p>
          <div className="dialog-actions">
            <button className="quiet-button" type="button" disabled={isDestructiveBusy} onClick={() => setDialog(null)}>Quedarme</button>
            <button className="danger-button" type="button" disabled={isDestructiveBusy} onClick={leaveCurrentSpace}>
              {isDestructiveBusy ? 'Saliendo…' : 'Salir'}
            </button>
          </div>
        </SettingsDialog>
      )}

      {dialog === 'delete' && (
        <SettingsDialog title="¿Eliminar tu cuenta?" onClose={closeDeleteDialog} danger>
          <p className="settings-copy">
            Se eliminan tu cuenta, tu espacio personal y los espacios donde eras el único miembro.
            No hay vuelta atrás.
          </p>
          {isGoogleAccount ? (
            <p className="settings-copy">Google te pedirá que confirmes que eres tú antes de borrarla.</p>
          ) : (
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Tu contraseña"
              autoComplete="current-password"
            />
          )}
          {deleteError && <p className="form-error">{deleteError}</p>}
          <div className="dialog-actions">
            <button className="quiet-button" type="button" disabled={isDestructiveBusy} onClick={closeDeleteDialog}>Cancelar</button>
            <button
              className="danger-button filled"
              type="button"
              disabled={isDestructiveBusy || (!isGoogleAccount && !password)}
              onClick={deleteAccount}>
              {isDestructiveBusy ? 'Eliminando…' : 'Eliminar'}
            </button>
          </div>
        </SettingsDialog>
      )}

      {(dialog === 'terms' || dialog === 'privacy') && (
        <SettingsDialog
          title={dialog === 'terms' ? 'Términos de uso' : 'Política de Privacidad'}
          onClose={() => setDialog(null)}
          legal>
          <LegalDocument markdown={dialog === 'terms' ? TermsMarkdown : PrivacyMarkdown} />
        </SettingsDialog>
      )}
    </section>
  );
}

function SettingsDialog({
  title,
  children,
  onClose,
  danger,
  legal,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  danger?: boolean;
  legal?: boolean;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal-card settings-dialog ${danger ? 'danger-card' : ''} ${legal ? 'legal-dialog' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}

function inlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return <a href={link[2]} target="_blank" rel="noreferrer" key={index}>{link[1]}</a>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function LegalDocument({ markdown }: { markdown: string }) {
  const lines = markdown.split('\n');
  return (
    <div className="legal-document">
      {lines.map((line, index) => {
        const clean = line.trim();
        if (!clean) return null;
        if (clean.startsWith('### ')) return <h4 key={index}>{inlineMarkdown(clean.slice(4))}</h4>;
        if (clean.startsWith('## ')) return <h3 key={index}>{inlineMarkdown(clean.slice(3))}</h3>;
        if (clean.startsWith('# ')) return <h2 key={index}>{inlineMarkdown(clean.slice(2))}</h2>;
        if (clean.startsWith('- ')) return <p className="legal-list-item" key={index}>• {inlineMarkdown(clean.slice(2))}</p>;
        return <p key={index}>{inlineMarkdown(clean)}</p>;
      })}
    </div>
  );
}
