import type { StudioCopy } from '../../_lib/studio-copy';
import styles from '../_styles/shell.module.css';

export function WorkspaceConnectedStatus({ conflict, projectAccessError, notices }: {
  conflict: boolean;
  projectAccessError: boolean;
  notices: StudioCopy['notices'];
}) {
  return (
    <>
      {conflict ? (
        <div className={styles.editorToast} role="alert" data-studio-revision-conflict="true">
          <span>{notices.workspaceConflict}</span>{' '}
          <button type="button" onClick={() => window.location.reload()}>{notices.reloadServerVersion}</button>
        </div>
      ) : null}
      {projectAccessError ? (
        <div className={styles.editorToast} role="alert" data-studio-project-access-error="true">
          {notices.projectAccessError}
        </div>
      ) : null}
    </>
  );
}
