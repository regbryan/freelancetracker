import { useParams } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import SignaturePad from '../components/SignaturePad'
import { FileCheck, Loader2, CheckCircle2 } from 'lucide-react'

interface ContractData {
  id: string
  title: string
  content: string
  status: string
  sign_token: string
  created_at: string
  clients: {
    id: string
    name: string
    company: string | null
  } | null
  contract_signatures: {
    id: string
    signer_name: string
    signed_at: string
  }[]
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function ContractSign() {
  const { token } = useParams<{ token: string }>()
  const [contract, setContract] = useState<ContractData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signerEmail, setSignerEmail] = useState('')
  const [signing, setSigning] = useState(false)
  const signatureDataRef = useRef<string>('')

  useEffect(() => {
    async function fetchContract() {
      if (!token) {
        setError('Invalid signing link.')
        setLoading(false)
        return
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('contracts')
          .select('*, clients(id, name, company), contract_signatures(*)')
          .eq('sign_token', token)
          .single()

        if (fetchError || !data) {
          setError('Contract not found. This link may be invalid or expired.')
          setLoading(false)
          return
        }

        setContract(data as ContractData)

        if (data.status === 'signed' || (data.contract_signatures && data.contract_signatures.length > 0)) {
          setSigned(true)
        }
      } catch {
        setError('Failed to load contract. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    fetchContract()
  }, [token])

  async function handleSign() {
    if (!contract) return
    if (!signerName.trim()) {
      alert('Please enter your name.')
      return
    }
    if (!signatureDataRef.current) {
      alert('Please draw your signature.')
      return
    }

    setSigning(true)
    try {
      const { error: sigError } = await supabase
        .from('contract_signatures')
        .insert({
          contract_id: contract.id,
          signer_name: signerName.trim(),
          signer_email: signerEmail.trim() || null,
          signature_data: signatureDataRef.current,
        })

      if (sigError) throw sigError

      const { error: updateError } = await supabase
        .from('contracts')
        .update({ status: 'signed' })
        .eq('id', contract.id)

      if (updateError) throw updateError

      setSigned(true)
    } catch (err) {
      alert(`Failed to sign contract: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSigning(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="text-blue-600 animate-spin" />
          <p className="text-gray-500 text-sm">Loading contract...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !contract) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <FileCheck size={40} className="text-gray-300 mx-auto mb-4" />
          <h1 className="text-gray-800 text-lg font-bold mb-2">Contract Not Found</h1>
          <p className="text-gray-500 text-sm">{error || 'This signing link is invalid or has expired.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <FileCheck size={20} className="text-white" />
          </div>
          <div>
            <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-[1.5px]">
              Contract for Review & Signature
            </p>
          </div>
        </div>

        {/* Contract Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Contract Meta */}
          <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-4 border-b border-gray-100">
            <h1 className="text-gray-900 text-xl sm:text-2xl font-bold mb-3">
              {contract.title}
            </h1>
            {contract.clients && (
              <p className="text-gray-500 text-sm">
                Prepared for: <span className="font-semibold text-gray-700">{contract.clients.name}</span>
                {contract.clients.company && (
                  <span className="text-gray-400"> ({contract.clients.company})</span>
                )}
              </p>
            )}
            <p className="text-gray-400 text-xs mt-1">
              {formatDate(contract.created_at)}
            </p>
          </div>

          {/* Contract Content */}
          <div className="px-6 sm:px-8 py-6">
            <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
              {contract.content}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 mx-6 sm:mx-8" />

          {/* Signing Section */}
          <div className="px-6 sm:px-8 py-6">
            {signed ? (
              /* Already signed */
              <div className="flex items-center gap-3 bg-green-50 rounded-xl p-4">
                <CheckCircle2 size={24} className="text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-green-800 text-sm font-semibold">This contract has been signed</p>
                  <p className="text-green-600 text-xs mt-0.5">
                    Thank you for signing. A copy has been recorded.
                  </p>
                </div>
              </div>
            ) : (
              /* Sign form */
              <div className="flex flex-col gap-5">
                <h2 className="text-gray-900 text-lg font-bold">Sign This Contract</h2>

                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="signer-name" className="text-gray-600 text-xs font-semibold">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="signer-name"
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="signer-email" className="text-gray-600 text-xs font-semibold">
                    Email <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="signer-email"
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Signature Pad */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-600 text-xs font-semibold">
                    Signature <span className="text-red-500">*</span>
                  </label>
                  <SignaturePad
                    onSave={(dataUrl) => {
                      signatureDataRef.current = dataUrl
                    }}
                    onClear={() => {
                      signatureDataRef.current = ''
                    }}
                  />
                </div>

                {/* Sign Button */}
                <button
                  onClick={handleSign}
                  disabled={signing || !signerName.trim()}
                  className="flex items-center justify-center gap-2 h-11 px-6 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #305445 0%, #3e6b5a 100%)' }}
                >
                  {signing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Signing...
                    </>
                  ) : (
                    'Sign Contract'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-xs mt-6">
          Powered by Freelance Tracker
        </p>
      </div>
    </div>
  )
}
