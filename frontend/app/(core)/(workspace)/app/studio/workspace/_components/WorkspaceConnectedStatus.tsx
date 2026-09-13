import type { StudioCopy } from '../../_lib/studio-copy';
import styles from '../_styles/shell.module.css';

export function WorkspaceConnectedStatus({ conflict, projectAccessError, notices, onReloadServerVersion }: {
  conflict: boolean;
  onReloadServerVersion: () => void;
  projectAccessError: boolean;
  notices: StudioCopy['notices'];
}) {
  return (
    <>
      {conflict ? (
        <div className={`${styles.editorToast} ${styles.connectedStatus}`} role="alert" data-studio-revision-conflict="true">
          <span>{notices.workspaceConflict}</span>{' '}
          <button type="button" onClick={onReloadServerVersion}>{notices.reloadServerVersion}</button>
        </div>
      ) : null}
      {projectAccessError ? (
        <div className={`${styles.editorToast} ${styles.connectedStatus}`} role="alert" data-studio-project-access-error="true">
          {notices.projectAccessError}
        </div>
      ) : null}
    </>
  );
}
