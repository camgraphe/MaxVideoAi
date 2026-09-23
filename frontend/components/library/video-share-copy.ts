export function videoShareCopy(locale: string) {
  if (locale.startsWith('fr')) return {
    share: 'Partager', link: 'Lien', email: 'E-mail', reels: 'Reels', shorts: 'Shorts', more: 'Autres',
    heading: 'Partager', signature: 'Signature proposée', defaultSignature: 'Vidéo créée avec MaxVideoAI', hashtag: 'Hashtag proposé',
    shareApps: 'Via les apps', saveMp4: 'Enregistrer MP4', preparing: 'Préparation…',
    publicNotice: 'Toute personne ayant le lien peut voir cette vidéo.', exampleNotice: 'Lien vers la page publique de cette vidéo.', revoke: 'Désactiver le lien',
    copied: 'Lien copié', copySignature: 'Copier la signature', signatureCopied: 'Signature copiée', copyHashtag: 'Copier le hashtag', hashtagCopied: 'Hashtag copié',
    linkUnavailable: 'Lien durable indisponible pour cet original. Le partage du fichier reste possible.',
    linkRevoked: 'Lien désactivé. Rouvrez le partage pour en créer un nouveau.',
    fileUnavailable: 'Le partage du fichier n’est pas disponible ici. Enregistrez le MP4 pour le publier.',
    shareFailed: 'Impossible de préparer le partage. Réessayez.', revoking: 'Désactivation…',
    nativeLink: 'Partager le lien via les apps',
  };
  if (locale.startsWith('es')) return {
    share: 'Compartir', link: 'Enlace', email: 'E-mail', reels: 'Reels', shorts: 'Shorts', more: 'Otros',
    heading: 'Compartir', signature: 'Firma sugerida', defaultSignature: 'Vídeo creado con MaxVideoAI', hashtag: 'Hashtag sugerido',
    shareApps: 'Con apps', saveMp4: 'Guardar MP4', preparing: 'Preparando…',
    publicNotice: 'Cualquiera que tenga el enlace puede ver este vídeo.', exampleNotice: 'Enlace a la página pública de este vídeo.', revoke: 'Desactivar enlace',
    copied: 'Enlace copiado', copySignature: 'Copiar firma', signatureCopied: 'Firma copiada', copyHashtag: 'Copiar hashtag', hashtagCopied: 'Hashtag copiado',
    linkUnavailable: 'No hay enlace duradero para este original. Puedes compartir el archivo.',
    linkRevoked: 'Enlace desactivado. Vuelve a abrir Compartir para crear otro.',
    fileUnavailable: 'No se puede compartir el archivo aquí. Guarda el MP4 para publicarlo.',
    shareFailed: 'No se pudo preparar el contenido. Inténtalo de nuevo.', revoking: 'Desactivando…',
    nativeLink: 'Compartir enlace con apps',
  };
  return {
    share: 'Share', link: 'Link', email: 'E-mail', reels: 'Reels', shorts: 'Shorts', more: 'More',
    heading: 'Share', signature: 'Suggested signature', defaultSignature: 'Video created with MaxVideoAI', hashtag: 'Suggested hashtag',
    shareApps: 'Via apps', saveMp4: 'Save MP4', preparing: 'Preparing…',
    publicNotice: 'Anyone with the link can view this video.', exampleNotice: 'Link to this video’s public page.', revoke: 'Disable link',
    copied: 'Link copied', copySignature: 'Copy signature', signatureCopied: 'Signature copied', copyHashtag: 'Copy hashtag', hashtagCopied: 'Hashtag copied',
    linkUnavailable: 'A lasting link is unavailable for this original. You can still share the file.',
    linkRevoked: 'Link disabled. Reopen Share to create a new one.',
    fileUnavailable: 'File sharing is unavailable here. Save the MP4 to post it.',
    shareFailed: 'Unable to prepare sharing. Please try again.', revoking: 'Disabling…',
    nativeLink: 'Share link via apps',
  };
}
