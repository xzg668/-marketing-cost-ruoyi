export function technicalDataPersonLabel(person) {
  if (!person) return ''
  return person.employeeNo ? `${person.name}（${person.employeeNo}）` : person.name
}

const paths = value => String(value || '').split('；').map(path => path.split('/').map(part => part.trim()).filter(Boolean)).filter(path => path.length)

function departmentLocation(person) {
  const targets = paths(person.targetDepartment)
  const departments = paths(person.department)
  // 一人兼属多个部门时只出现一次；完整归属保留在人员提示中，人员值始终为系统 userId。
  for (const target of targets) {
    for (const department of departments) {
      const start = department.findIndex((_, index) => target.every((part, offset) => department[index + offset] === part))
      if (start !== -1) {
        return { target: target.join('/'), name: target.at(-1), department: department.slice(start + target.length).join(' / ') }
      }
    }
  }
  return {
    target: targets[0]?.join('/') || '未提供大部门',
    name: targets[0]?.at(-1) || '未提供大部门',
    department: departments[0]?.slice(-2).join(' / ') || '',
  }
}

/** 将当前搜索结果组织为事业部 → 实际部门 → 人员；计数仅表示本次返回的人员。 */
export function buildTechnicalDataPeopleTree(people) {
  const divisions = new Map()
  const departments = new Map()
  const seen = new Set()
  for (const person of people || []) {
    if (person.userId == null || seen.has(String(person.userId))) continue
    seen.add(String(person.userId))
    const location = departmentLocation(person)
    let division = divisions.get(location.target)
    if (!division) {
      division = { value: `division:${encodeURIComponent(location.target)}`, label: location.name, kind: 'division', count: 0, children: [] }
      divisions.set(location.target, division)
    }
    division.count++
    let parent = division
    if (location.department) {
      const key = JSON.stringify([location.target, location.department])
      parent = departments.get(key)
      if (!parent) {
        parent = { value: `department:${encodeURIComponent(key)}`, label: location.department, kind: 'department', count: 0, children: [] }
        departments.set(key, parent)
        division.children.push(parent)
      }
      parent.count++
    }
    parent.children.push({
      value: person.userId,
      label: technicalDataPersonLabel(person),
      kind: 'person',
      person,
      title: [technicalDataPersonLabel(person), person.targetDepartment, person.department, person.position].filter(Boolean).join('\n'),
    })
  }
  return [...divisions.values()]
}
