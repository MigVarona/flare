'use client';

import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import Image from 'next/image';
import { FormEvent, useState } from 'react';

import { FlareBrand } from '@/components/flare-brand';
import { LegalModal } from '@/components/legal-modal';
import { auth, db, googleProvider } from '@/lib/firebase';
import { readableFirebaseError } from '@/lib/firebase-errors';
import { PrivacyMarkdown } from '../../../mobile/src/constants/privacy';
import { TermsMarkdown } from '../../../mobile/src/constants/terms';

function GoogleMark() {
  return (
    <svg className="google-mark" width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsBusy(true);

    try {
      await setPersistence(auth, browserLocalPersistence);
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cleanName = name.trim();
        if (!cleanName) throw new Error('Escribe tu nombre.');
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: cleanName });
        await setDoc(doc(db, 'users', credential.user.uid), {
          email: credential.user.email ?? email.trim(),
          displayName: cleanName,
          createdAt: serverTimestamp(),
        });
      }
    } catch (caught) {
      setError(readableFirebaseError(caught));
    } finally {
      setIsBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    setError('');
    setIsBusy(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithPopup(auth, googleProvider);
      const profileRef = doc(db, 'users', credential.user.uid);
      const profile = await getDoc(profileRef);
      if (!profile.exists()) {
        await setDoc(profileRef, {
          email: credential.user.email ?? '',
          displayName: credential.user.displayName?.trim() || 'Alguien',
          createdAt: serverTimestamp(),
        });
      }
    } catch (caught) {
      setError(readableFirebaseError(caught));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <a className="brand auth-brand" href="#" aria-label="Flare">
          <FlareBrand size={46} />
        </a>

        <div className="auth-story-content">
          <p className="eyebrow">COLABORACIÓN EN TIEMPO REAL</p>
          <h1>Un espacio para organizar cualquier grupo.</h1>
          <p className="auth-copy">
            Centraliza mensajes, avisos, fotos y recordatorios. Para equipos de trabajo,
            proyectos, estudios, asociaciones, comunidades o cualquier grupo.
          </p>

          <ul className="auth-feature-list" aria-label="Grupos que pueden utilizar Flare">
            <li><span aria-hidden="true">↗</span> Equipos</li>
            <li><span aria-hidden="true">✓</span> Proyectos</li>
            <li><span aria-hidden="true">◎</span> Estudios</li>
            <li><span aria-hidden="true">◇</span> Comunidades</li>
          </ul>

          <aside className="android-access-card" aria-labelledby="android-access-title">
            <div className="android-access-visual" aria-hidden="true">
              <span className="android-access-glow" />
              <Image
                src="/android-head.svg"
                alt=""
                width={152}
                height={89}
                className="android-access-logo"
              />
            </div>
            <div className="android-access-content">
              <small>APP PARA ANDROID™ · PRUEBA CERRADA</small>
              <h3 id="android-access-title">Lleva Flare contigo</h3>
              <p>La app ya está disponible en Google Play para un grupo limitado de testers.</p>
              <div className="android-access-actions">
                <a href="mailto:info@wearecapa.es?subject=Solicitud%20de%20acceso%20a%20Flare%20para%20Android">
                  Solicitar acceso
                  <span aria-hidden="true">→</span>
                </a>
                <a
                  href="https://play.google.com/apps/testing/com.mivarona.churriapp"
                  target="_blank"
                  rel="noreferrer">
                  Ya tengo acceso <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
            <p className="android-attribution">
              El robot Android se reproduce a partir del trabajo creado y compartido por Google y
              se usa conforme a la licencia Creative Commons 3.0 Atribución. Android es una marca
              de Google LLC.
            </p>
          </aside>
        </div>

        <div className="auth-collab-card" aria-label="Ejemplo de actividad en un espacio compartido">
          <div className="auth-collab-heading">
            <div>
              <span className="auth-collab-kicker">ESPACIO DE EQUIPO</span>
              <strong>Proyecto Atlas</strong>
            </div>
            <div className="auth-collab-people" aria-label="Cinco personas colaborando">
              <i>L</i><i>D</i><i>+3</i>
            </div>
          </div>
          <div className="auth-collab-grid">
            <div className="auth-collab-item">
              <span className="auth-collab-icon pink" aria-hidden="true">✓</span>
              <span><small>TAREA COMPARTIDA</small><strong>Revisar la propuesta</strong></span>
              <em>Hoy</em>
            </div>
            <div className="auth-collab-item">
              <span className="auth-collab-icon blue" aria-hidden="true">↗</span>
              <span><small>ACTUALIZACIÓN</small><strong>La reunión pasa a las 10:30</strong></span>
              <em>Ahora</em>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
            <div className="auth-account-switch">
              <span>{mode === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes cuenta?'}</span>
              <button
                className="auth-mode-link"
                type="button"
                onClick={() => {
                  setMode((current) => current === 'login' ? 'register' : 'login');
                  setError('');
                }}>
                {mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
                <span aria-hidden="true">→</span>
              </button>
            </div>

            <p className="eyebrow">
              {mode === 'login' ? 'INICIA SESIÓN' : 'EMPIEZA EN FLARE'}
            </p>
            <h2>{mode === 'login' ? 'Entra en Flare' : 'Crea una cuenta'}</h2>
            <p className="form-intro">
              {mode === 'login'
                ? 'Usa tu cuenta para acceder a todos tus espacios.'
                : 'Crea un espacio para cualquier grupo o únete a uno con su llave.'}
            </p>

            <form onSubmit={submit} className="auth-form">
              {mode === 'register' && (
                <label>
                  Nombre
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={20}
                    autoComplete="name"
                    required
                  />
                </label>
              )}
              <label>
                Correo
                <input
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Contraseña
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={6}
                  required
                />
              </label>

              {error && <p className="form-error" role="alert">{error}</p>}

              <button className="primary-button auth-submit" type="submit" disabled={isBusy}>
                {isBusy ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>
              {mode === 'register' && (
                <p className="auth-legal-copy">
                  Al crear una cuenta, confirmas que tienes 16 años o más y aceptas los{' '}
                  <button type="button" onClick={() => setLegal('terms')}>Términos de uso</button>
                  {' '}y la{' '}
                  <button type="button" onClick={() => setLegal('privacy')}>Política de Privacidad</button>.
                </p>
              )}
            </form>

            <div className="form-divider"><span>o</span></div>
            <button className="google-button" type="button" onClick={continueWithGoogle} disabled={isBusy}>
              <GoogleMark />
              <span>Continuar con Google</span>
            </button>

            <p className="auth-sync-note">
              La misma cuenta funciona en la web y en la app móvil.
            </p>
        </div>
      </section>
      {legal && (
        <LegalModal
          title={legal === 'terms' ? 'Términos de uso' : 'Política de Privacidad'}
          markdown={legal === 'terms' ? TermsMarkdown : PrivacyMarkdown}
          onClose={() => setLegal(null)}
        />
      )}
    </main>
  );
}
