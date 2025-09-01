import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Edit, Trash2, Users, X } from 'lucide-react'
import { customerAPI } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { useToast } from '../components/ui/useToast'
import type { Customer } from '../types'

export function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const { notify } = useToast()

  const {
    data: customersResponse,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['customers', { search: searchTerm, page }],
    queryFn: () => customerAPI.getAll({
      search: searchTerm || undefined,
      page,
      per_page: 25
    })
  })

  const customers = customersResponse?.data?.items || []
  const total = customersResponse?.data?.total || 0
  const totalPages = customersResponse?.data?.pages || 0

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setPage(1) // Reset to first page on search
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          Failed to load customers. Please try again.
        </div>
        <button onClick={() => refetch()} className="btn-primary">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600 mt-1">
            Manage your studio customers and their information.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} className="flex items-center">
          <Plus className="h-5 w-5 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Search and filters */}
      <div className="card">
        <div className="card-body">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search customers by name or email..."
              className="pl-10"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
        </div>
      </div>

      {/* Customers table */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">
            All Customers ({total})
          </h3>
        </div>
        <div className="card-body p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm ? 'No customers match your search criteria.' : 'Get started by adding your first customer.'}
              </p>
              <Button onClick={() => setShowModal(true)}>Add Customer</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customers.map((customer: Customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {customer.name}
                        </div>
                        {customer.notes && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {customer.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(customer.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          <button
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit customer"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            className="text-red-600 hover:text-red-900"
                            title="Delete customer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((page - 1) * 25) + 1} to {Math.min(page * 25, total)} of {total} results
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="secondary"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-700">
              Page {page} of {totalPages}
            </span>
            <Button variant="secondary"
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {showModal && (
        <AddCustomerModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            notify({ kind: 'success', title: 'Customer added', message: 'New customer has been created.' })
            setShowModal(false)
            refetch()
          }}
        />
      )}
    </div>
  )
}

function AddCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const setField = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) e.email = 'Email is invalid'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      await customerAPI.create({ name: form.name.trim(), email: form.email.trim(), phone: form.phone || undefined, notes: form.notes || undefined })
      onCreated()
    } catch (err) {
      const backendErrors = (err as { response?: { data?: { errors?: Record<string, string[] | string> } } })?.response?.data?.errors
      if (backendErrors && typeof backendErrors === 'object') {
        const mapped: Record<string, string> = {}
        for (const key of Object.keys(backendErrors)) {
          const val = backendErrors[key]
          mapped[key] = Array.isArray(val) ? String(val[0]) : String(val)
        }
        setErrors(mapped)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 animate-fade-slide-up">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Add Customer</h3>
            <button className="p-1 rounded hover:bg-gray-100" onClick={onClose} aria-label="Close">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div>
              <label htmlFor="name" className="form-label">Full name *</label>
              <Input id="name" name="name" value={form.name} onChange={setField} placeholder="e.g., John Doe" required />
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="email" className="form-label">Email *</label>
              <Input id="email" name="email" type="email" value={form.email} onChange={setField} placeholder="name@example.com" required />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="phone" className="form-label">Phone</label>
              <Input id="phone" name="phone" value={form.phone} onChange={setField} placeholder="Optional" />
            </div>
            <div>
              <label htmlFor="notes" className="form-label">Notes</label>
              <Textarea id="notes" name="notes" value={form.notes} onChange={setField} rows={3} placeholder="Any relevant details..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={submitting} className={submitting ? 'opacity-50 cursor-not-allowed' : ''}>
                {submitting ? 'Saving…' : 'Create'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}