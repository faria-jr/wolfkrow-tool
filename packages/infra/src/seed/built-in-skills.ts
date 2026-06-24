/**
 * Built-in skills loader
 *
 * Skills are stored as Markdown files in `.wolfkrow/skills/*.md` with YAML
 * frontmatter. This module re-exports the loader so existing
 * `BUILT_IN_SKILLS` consumers can migrate to the async API.
 */

export { loadBuiltInSkills, type LoadedSkill } from './skill-loader';
