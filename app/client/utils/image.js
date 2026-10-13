const image = imagepath => imagepath.replace(/\\/g, '\\\\');
// a file path as a file:// link; # % ? in a folder or file name no longer cut the link
export const fileUrl = p =>
  'file://' + String(p).replace(/%/g, '%25').replace(/#/g, '%23').replace(/\?/g, '%3F');
export default image;
