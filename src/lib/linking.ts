type LinkMap = {
  [key: string]: string[];
};

const links: LinkMap = {};

export function linkItems(a: string, b: string) {
  if (!links[a]) links[a] = [];
  if (!links[b]) links[b] = [];

  links[a].push(b);
  links[b].push(a);
}

export function getLinks(id: string) {
  return links[id] || [];
}
