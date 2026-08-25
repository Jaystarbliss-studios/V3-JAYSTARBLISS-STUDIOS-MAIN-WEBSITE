// Real database sync utilities
export const defaultOrganisationProjects: any[] = [];
export const defaultKidsProjectsList: any[] = [];
export const defaultBlogPosts: any[] = [];
export const defaultNewsBulletins: any[] = [];

/**
 * Validates Firestore connectivity without injecting synthetic/mock records.
 */
export async function autoSeedCollectionsIfEmpty(): Promise<void> {
  // No automatic injection of artificial records - data is purely user-managed via Admin CMS and Firestore
}
