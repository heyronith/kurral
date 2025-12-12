import type { Chirp } from '../../types';

export interface ChirpVisibilityOptions {
  profileOwnerId?: string | null;
}

/**
 * Decide if a chirp should be shown based on its fact-check status and the current viewer.
 * Blocked posts are only surfaced when the viewer is the author and is looking at their own profile.
 */
export function shouldDisplayChirp(
  chirp: Chirp,
  viewerId?: string | null,
  options?: ChirpVisibilityOptions
): boolean {
  // If not blocked, always show
  if (chirp.factCheckStatus !== 'blocked') {
    return true;
  }

  // Blocked posts require a viewer
  if (!viewerId) {
    return false;
  }

  // Blocked posts are only visible to the author
  const isAuthor = viewerId === chirp.authorId;
  if (!isAuthor) {
    return false;
  }

  // If viewing own profile, show blocked posts
  // Otherwise, hide them (even from author in feeds/search/etc)
  const viewingOwnProfile = !!options?.profileOwnerId && viewerId === options.profileOwnerId;
  
  return viewingOwnProfile;
}

export function filterChirpsForViewer(
  chirps: Chirp[],
  viewerId?: string | null,
  options?: ChirpVisibilityOptions
): Chirp[] {
  return chirps.filter((chirp) => shouldDisplayChirp(chirp, viewerId, options));
}
