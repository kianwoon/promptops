import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { X } from 'lucide-react'
import { PublicLayout } from './PublicLayout'
import { SignInModal } from './auth/SignInModal'
import { GoogleLoginButton } from './auth/GoogleLoginButton'

export function PublicLayoutWrapper() {
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)

  return (
    <PublicLayout 
      onSignInClick={() => setIsSignInModalOpen(true)}
      onRegisterClick={() => setIsRegisterModalOpen(true)}
    >
      <Outlet />
      
      <SignInModal 
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
        onSwitchToRegister={() => {
          setIsSignInModalOpen(false)
          setIsRegisterModalOpen(true)
        }}
      />
      
      {/* Simple register modal placeholder */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-md mx-4">
            <button
              onClick={() => setIsRegisterModalOpen(false)}
              className="absolute -top-4 -right-4 z-10 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="bg-white rounded-lg shadow-2xl p-6">
              <h3 className="text-xl font-bold mb-2">Get Started</h3>
              <p className="text-gray-600 mb-4">Start your free trial of PromptOps</p>
              <p className="text-gray-600 mb-4">Sign up form would go here. For now, please use Google authentication.</p>
              <GoogleLoginButton className="w-full" />
              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    setIsRegisterModalOpen(false)
                    setIsSignInModalOpen(true)
                  }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PublicLayout>
  )
}