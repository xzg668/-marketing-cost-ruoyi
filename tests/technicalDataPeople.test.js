import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTechnicalDataPeopleTree, technicalDataPersonLabel } from '../src/utils/technicalDataPeople.js'

test('选中后的标签保留姓名工号，不将长部门路径塞入输入框', () => {
  const label = technicalDataPersonLabel({
    name: '张三', employeeNo: 'E001', department: '商用制冷业务单元/技术中心/研发部',
  })
  assert.equal(label, '张三（E001）')
  assert.equal(technicalDataPersonLabel(null), '')
})

test('去掉重复的集团前缀，构建事业部、实际部门和人员三级目录', () => {
  const people = [
    { userId: 31, name: '张三', employeeNo: 'E001', targetDepartment: '商用制冷业务单元/技术中心', department: '三花控股集团/智控上市平台/商用制冷业务单元/技术中心/研发部', position: '工程师' },
    { userId: 32, name: '李四', employeeNo: 'E002', targetDepartment: '商用制冷业务单元/技术中心', department: '三花控股集团/智控上市平台/商用制冷业务单元/技术中心/研发部' },
  ]
  const tree = buildTechnicalDataPeopleTree(people)
  assert.equal(tree.length, 1)
  assert.equal(tree[0].label, '技术中心')
  assert.equal(tree[0].count, 2)
  const department = tree[0].children[0]
  assert.equal(department.label, '研发部')
  assert.equal(department.count, 2)
  assert.deepEqual(department.children.map(node => node.value), [31, 32])
  assert.equal(department.children[0].person, people[0])
  assert.ok(department.children[0].title.includes(people[0].department))
  assert.ok(department.children[0].title.includes('工程师'))
})

test('事业部直属人员直接显示为叶子，不重复显示同名部门', () => {
  const person = { userId: 1, name: '直属人员', targetDepartment: '业务单元/板换事业部', department: '集团/业务单元/板换事业部' }
  const tree = buildTechnicalDataPeopleTree([person])
  assert.equal(tree[0].children[0].kind, 'person')
  assert.equal(tree[0].children[0].value, 1)
})

test('兼属多部门或重复返回的同一人只出现一次，完整归属仍可查看', () => {
  const person = { userId: 1, name: '兼岗人员', targetDepartment: '业务单元/技术中心；业务单元/板换事业部', department: '集团/业务单元/技术中心/研发部；集团/业务单元/板换事业部/技术部' }
  const tree = buildTechnicalDataPeopleTree([person, { ...person }])
  assert.equal(tree.length, 1)
  assert.equal(tree[0].count, 1)
  assert.equal(tree[0].children[0].children.length, 1)
  assert.ok(tree[0].children[0].children[0].title.includes('板换事业部/技术部'))
})

test('不同事业部的同名部门不能混合，深层部门保留相对路径', () => {
  const tree = buildTechnicalDataPeopleTree([
    { userId: 1, name: '甲', targetDepartment: '业务单元/技术中心', department: '业务单元/技术中心/技术部/一组' },
    { userId: 2, name: '乙', targetDepartment: '业务单元/板换事业部', department: '业务单元/板换事业部/技术部/一组' },
  ])
  assert.equal(tree.length, 2)
  assert.notEqual(tree[0].children[0].value, tree[1].children[0].value)
  assert.equal(tree[0].children[0].label, '技术部 / 一组')
  assert.equal(tree[1].children[0].children[0].value, 2)
})

test('没有搜索结果时显示空树，缺失部门名称时不伪造归属', () => {
  assert.deepEqual(buildTechnicalDataPeopleTree([]), [])
  const tree = buildTechnicalDataPeopleTree([{ userId: 8, name: '缺部门人员' }])
  assert.equal(tree[0].label, '未提供大部门')
  assert.equal(tree[0].children[0].value, 8)
})
