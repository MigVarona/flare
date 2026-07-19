/**
 * Migración dura: couples/{id} → spaces/{id}.
 *
 * Convierte cada pareja en un espacio compartido de 2, conservando el MISMO id de documento
 * (los ids de fotos/avisos/mensajes también se conservan), de modo que:
 *   - las carpetas de Cloudinary (churri/{id}) siguen apuntando a sus ficheros,
 *   - las alarmas locales ya programadas siguen encontrando su aviso.
 *
 * Qué hace por cada pareja:
 *   1. Crea spaces/{id} con kind 'shared', nombre "Casa", los mismos memberIds/inviteCode/
 *      palette, y el mapa `members` (nombre + expoPushToken leídos de users/{uid}).
 *   2. Copia las subcolecciones reminders / photos / messages con sus ids.
 *      Los avisos ganan `targetUids`: la regla antigua era "suena en el móvil del otro",
 *      así que el destinatario es cada miembro que no lo creó.
 *   3. Reescribe invites/{code} de {coupleId} a {spaceId}.
 *
 * NO borra los documentos antiguos salvo que se pase --delete-old: primero se verifica,
 * después se destruye. Los usuarios conservan su campo coupleId huérfano (inofensivo:
 * las reglas nuevas ya no lo escriben ni lo leen).
 *
 * Orden de despliegue del pivote:
 *   1. node scripts/migrate-couples-to-spaces.mjs   (con GOOGLE_APPLICATION_CREDENTIALS)
 *   2. firebase deploy --only firestore:rules,functions  +  wrangler deploy (worker/)
 *   3. Publicar la versión nueva de la app (la anterior deja de poder escribir).
 *   4. Verificar, y entonces: node scripts/migrate-couples-to-spaces.mjs --delete-old
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=serviceAccount.json node scripts/migrate-couples-to-spaces.mjs [--dry-run] [--delete-old]
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const isDryRun = process.argv.includes('--dry-run');
const shouldDeleteOld = process.argv.includes('--delete-old');

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const Subcollections = ['reminders', 'photos', 'messages'];

async function memberProfile(uid) {
  const snapshot = await db.doc(`users/${uid}`).get();
  const data = snapshot.data() ?? {};
  return {
    name: data.displayName || 'Alguien',
    ...(data.expoPushToken ? { expoPushToken: data.expoPushToken } : {}),
  };
}

async function migrateCouple(coupleDoc) {
  const couple = coupleDoc.data();
  const memberIds = couple.memberIds ?? [];
  const spaceRef = db.doc(`spaces/${coupleDoc.id}`);

  if ((await spaceRef.get()).exists) {
    console.log(`  ~ spaces/${coupleDoc.id} ya existe, se omite`);
    return;
  }

  const members = {};
  for (const uid of memberIds) {
    members[uid] = await memberProfile(uid);
  }

  const space = {
    kind: 'shared',
    name: 'Casa',
    memberIds,
    members,
    inviteCode: couple.inviteCode ?? null,
    ...(couple.palette ? { palette: couple.palette } : {}),
    createdAt: couple.createdAt ?? Date.now(),
  };

  console.log(`  → spaces/${coupleDoc.id} (${memberIds.length} miembros)`);
  if (!isDryRun) await spaceRef.set(space);

  for (const name of Subcollections) {
    const docs = await coupleDoc.ref.collection(name).get();
    for (const entry of docs.docs) {
      const data = entry.data();
      // La regla antigua de los avisos: suenan en todos los móviles menos el del autor.
      // Un aviso en un espacio de una sola persona era para esa persona.
      if (name === 'reminders' && !data.targetUids) {
        const others = memberIds.filter((uid) => uid !== data.createdByUid);
        data.targetUids = others.length > 0 ? others : [...memberIds];
      }
      if (!isDryRun) await spaceRef.collection(name).doc(entry.id).set(data);
    }
    if (docs.size > 0) console.log(`      ${name}: ${docs.size}`);
  }

  // La llave pasa a señalar al espacio. Mismo código, mismo documento.
  if (couple.inviteCode) {
    const inviteRef = db.doc(`invites/${couple.inviteCode}`);
    const invite = await inviteRef.get();
    if (invite.exists && !isDryRun) {
      await inviteRef.set({ spaceId: coupleDoc.id, createdAt: invite.data().createdAt ?? Date.now() });
    }
  }
}

async function deleteOldCouple(coupleDoc) {
  for (const name of Subcollections) {
    const docs = await coupleDoc.ref.collection(name).get();
    for (const entry of docs.docs) {
      await entry.ref.delete();
    }
  }
  await coupleDoc.ref.delete();
  console.log(`  ✗ couples/${coupleDoc.id} eliminado`);
}

async function stripLegacyUserFields() {
  const users = await db.collection('users').get();
  for (const user of users.docs) {
    if (user.data().coupleId === undefined) continue;
    if (!isDryRun) await user.ref.update({ coupleId: FieldValue.delete() });
    console.log(`  · users/${user.id}: coupleId retirado`);
  }
}

const couples = await db.collection('couples').get();
console.log(`${couples.size} parejas encontradas${isDryRun ? ' (dry-run: no se escribe nada)' : ''}`);

for (const coupleDoc of couples.docs) {
  if (shouldDeleteOld) {
    await deleteOldCouple(coupleDoc);
  } else {
    await migrateCouple(coupleDoc);
  }
}

if (!shouldDeleteOld) {
  await stripLegacyUserFields();
}

console.log('Hecho.');
