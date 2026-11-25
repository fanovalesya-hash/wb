function publicUser(row, prefix = '') {
  if (!row || row[`${prefix}id`] == null) return null;
  return {
    id: row[`${prefix}id`],
    username: row[`${prefix}username`],
    display_name: row[`${prefix}display_name`],
    avatar_url: row[`${prefix}avatar_url`] ?? null,
    role: row[`${prefix}role`],
  };
}

// Строит дерево комментариев/ответов из плоского списка
function buildTree(items) {
  const byId = new Map(items.map((it) => [it.id, { ...it, children: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

module.exports = { publicUser, buildTree };