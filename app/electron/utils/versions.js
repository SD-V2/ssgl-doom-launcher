// "v2.0.0-devpreview.24" -> { nums: [2, 0, 0], pre: ['devpreview', 24] } or null
export const parseVersion = tag => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(String(tag || '').trim());
  if (!m) return null;
  return {
    nums: [Number(m[1]), Number(m[2]), Number(m[3])],
    pre: m[4] ? m[4].split('.').map(p => (/^\d+$/.test(p) ? Number(p) : p)) : []
  };
};

// -1 / 0 / 1 like the semver rules: 2.0.0 is newer than 2.0.0-beta.9
export const compareVersions = (a, b) => {
  for (let i = 0; i < 3; i++) {
    if (a.nums[i] !== b.nums[i]) return a.nums[i] < b.nums[i] ? -1 : 1;
  }
  if (!a.pre.length && !b.pre.length) return 0;
  if (!a.pre.length) return 1;
  if (!b.pre.length) return -1;

  const n = Math.max(a.pre.length, b.pre.length);
  for (let i = 0; i < n; i++) {
    const x = a.pre[i];
    const y = b.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x < y ? -1 : 1;
    if (typeof x === 'number') return -1;
    if (typeof y === 'number') return 1;
    return x < y ? -1 : 1;
  }
  return 0;
};

// "name/repository" of a GitHub repository, from what a person types or pastes:
//   SD-V2/ssgl-doom-launcher
//   https://github.com/SD-V2/ssgl-doom-launcher   (also www., a trailing /, .git,
//                                                   or a deeper link like /releases)
//   [SD-V2/ssgl-doom-launcher](https://github.com/SD-V2/ssgl-doom-launcher)
// -> 'SD-V2/ssgl-doom-launcher', or '' when it is not usable
export const cleanRepo = value => {
  let text = String(value || '').trim();

  // a link written like [text](https://...)
  const markdown = /\]\(\s*([^)\s]+)\s*\)/.exec(text);
  if (markdown) text = markdown[1];

  text = text.replace(/^<|>$/g, '').trim();

  const isLink = /^(https?:\/\/)?(www\.)?github\.com\//i.test(text);
  text = text.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '');
  text = text.split(/[?#]/)[0];

  const parts = text.split('/').filter(part => part !== '');
  // a plain name/repository has exactly two parts, a link may continue
  if (parts.length < 2 || (!isLink && parts.length !== 2)) return '';

  const owner = parts[0];
  const name = parts[1].replace(/\.git$/i, '');
  const valid = part => /^[A-Za-z0-9_.-]+$/.test(part) && !/^\.+$/.test(part);

  return valid(owner) && valid(name) ? `${owner}/${name}` : '';
};

// Is there a release newer than this program?
//   - releases tagged like a version are compared with the program version
//   - other tags (e.g. "latest-build" of the cloud build) count when they were
//     published clearly after this program was built, and not for the commit
//     this program was built from
export const findUpdate = (releases, current, build) => {
  const have = parseVersion(current);

  return (
    (releases || []).find(release => {
      if (release.draft) return false;

      const tag = parseVersion(release.tag_name);
      if (tag) return have ? compareVersions(tag, have) > 0 : false;

      if (!build || !build.time) return false;
      if (build.commit && release.target_commitish === build.commit) return false;
      const published = Date.parse(release.published_at);
      const built = Date.parse(build.time);
      return published - built > 45 * 60 * 1000;
    }) || null
  );
};
