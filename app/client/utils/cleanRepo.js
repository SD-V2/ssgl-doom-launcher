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

export default cleanRepo;
