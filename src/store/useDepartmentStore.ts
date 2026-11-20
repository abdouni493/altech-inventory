import { create } from 'zustand'
import type { Department } from '@/types'
import { uid } from '@/utils/helpers'

interface DepartmentState {
  departments: Department[]
  addDepartment: (data: Omit<Department, 'id' | 'createdAt'>) => Department
  updateDepartment: (id: string, data: Partial<Department>) => void
  deleteDepartment: (id: string) => void
}

export const useDepartmentStore = create<DepartmentState>()((set) => ({
  departments: [],
  addDepartment: (data) => {
    const department: Department = { ...data, id: uid('dep'), createdAt: new Date().toISOString() }
    set((s) => ({ departments: [department, ...s.departments] }))
    return department
  },
  updateDepartment: (id, data) =>
    set((s) => ({ departments: s.departments.map((d) => (d.id === id ? { ...d, ...data } : d)) })),
  deleteDepartment: (id) => set((s) => ({ departments: s.departments.filter((d) => d.id !== id) })),
}))
