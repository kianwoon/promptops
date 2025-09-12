import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Mail, 
  Lock, 
  User, 
  Building, 
  Phone, 
  Eye, 
  EyeOff, 
  Shield, 
  CheckCircle,
  AlertCircle,
  Users,
  Briefcase
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'

interface RegisterForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  role: string
  companySize: string
  password: string
  confirmPassword: string
  agreeToTerms: boolean
  agreeToPrivacy: boolean
}

export function Register() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [step, setStep] = useState(1)
  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    role: '',
    companySize: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
    agreeToPrivacy: false
  })

  const companySizes = [
    { value: '1-10', label: '1-10 employees' },
    { value: '11-50', label: '11-50 employees' },
    { value: '51-200', label: '51-200 employees' },
    { value: '201-1000', label: '201-1000 employees' },
    { value: '1000+', label: '1000+ employees' }
  ]

  const roles = [
    { value: 'developer', label: 'Developer/Engineer' },
    { value: 'manager', label: 'Product Manager' },
    { value: 'director', label: 'Director/VP' },
    { value: 'executive', label: 'C-Level Executive' },
    { value: 'other', label: 'Other' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      // Validate passwords match
      if (registerForm.password !== registerForm.confirmPassword) {
        setError('Passwords do not match')
        return
      }

      // Validate password strength
      if (registerForm.password.length < 8) {
        setError('Password must be at least 8 characters long')
        return
      }

      // Validate terms agreement
      if (!registerForm.agreeToTerms || !registerForm.agreeToPrivacy) {
        setError('You must agree to the terms and privacy policy')
        return
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Create user object
      const newUser = {
        id: Date.now().toString(),
        email: registerForm.email,
        name: `${registerForm.firstName} ${registerForm.lastName}`,
        role: 'user', // Default role, can be changed by admin
        organization: registerForm.company,
        companySize: registerForm.companySize,
        phone: registerForm.phone,
        createdAt: new Date().toISOString()
      }

      // Store user in localStorage
      localStorage.setItem('user', JSON.stringify(newUser))
      localStorage.setItem('isAuthenticated', 'true')
      
      setSuccess('Registration successful! Redirecting to dashboard...')
      
      // Redirect to dashboard
      setTimeout(() => {
        navigate('/dashboard')
      }, 1500)

    } catch (error) {
      setError('An error occurred during registration')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof RegisterForm, value: string | boolean) => {
    setRegisterForm(prev => ({ ...prev, [field]: value }))
    if (error) setError('')
  }

  const nextStep = () => {
    if (step === 1) {
      // Validate first step
      if (!registerForm.firstName || !registerForm.lastName || !registerForm.email) {
        setError('Please fill in all required fields')
        return
      }
      if (!registerForm.email.includes('@')) {
        setError('Please enter a valid email address')
        return
      }
    }
    setStep(step + 1)
    setError('')
  }

  const prevStep = () => {
    setStep(step - 1)
    setError('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Logo and Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="h-12 w-12 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xl">P</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">PromptOps</h1>
          <p className="text-gray-600 mt-2">Create your enterprise account</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Create Account</CardTitle>
                <CardDescription>
                  Step {step} of 3
                </CardDescription>
              </div>
              <div className="flex space-x-2">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`w-8 h-2 rounded-full ${
                      s <= step ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Step 1: Personal Information */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          id="firstName"
                          placeholder="John"
                          className="pl-10"
                          value={registerForm.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          id="lastName"
                          placeholder="Doe"
                          className="pl-10"
                          value={registerForm.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@company.com"
                        className="pl-10"
                        value={registerForm.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="phone"
                        placeholder="+1 (555) 123-4567"
                        className="pl-10"
                        value={registerForm.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="button" onClick={nextStep}>
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Company Information */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">Company Name *</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="company"
                        placeholder="Acme Corporation"
                        className="pl-10"
                        value={registerForm.company}
                        onChange={(e) => handleInputChange('company', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companySize">Company Size</Label>
                      <Select value={registerForm.companySize} onValueChange={(value) => handleInputChange('companySize', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {companySizes.map((size) => (
                            <SelectItem key={size.value} value={size.value}>
                              {size.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role">Your Role</Label>
                      <Select value={registerForm.role} onValueChange={(value) => handleInputChange('role', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={prevStep}>
                      Back
                    </Button>
                    <Button type="button" onClick={nextStep}>
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Password and Terms */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 pr-10"
                        value={registerForm.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Must be at least 8 characters long
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 pr-10"
                        value={registerForm.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="agreeToTerms"
                        checked={registerForm.agreeToTerms}
                        onCheckedChange={(checked) => handleInputChange('agreeToTerms', checked as boolean)}
                      />
                      <label htmlFor="agreeToTerms" className="text-sm text-gray-600 leading-tight">
                        I agree to the{' '}
                        <Link to="/terms" className="text-blue-600 hover:underline">
                          Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link to="/acceptable-use" className="text-blue-600 hover:underline">
                          Acceptable Use Policy
                        </Link>
                      </label>
                    </div>

                    <div className="flex items-start space-x-2">
                      <Checkbox
                        id="agreeToPrivacy"
                        checked={registerForm.agreeToPrivacy}
                        onCheckedChange={(checked) => handleInputChange('agreeToPrivacy', checked as boolean)}
                      />
                      <label htmlFor="agreeToPrivacy" className="text-sm text-gray-600 leading-tight">
                        I agree to the{' '}
                        <Link to="/privacy" className="text-blue-600 hover:underline">
                          Privacy Policy
                        </Link>{' '}
                        and consent to the processing of my personal data
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={prevStep}>
                      Back
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Creating Account...' : 'Create Account'}
                    </Button>
                  </div>
                </div>
              )}
            </form>

            <div className="text-center mt-6">
              <span className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link 
                  to="/login" 
                  className="text-blue-600 hover:underline font-medium"
                >
                  Sign in
                </Link>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Security Note */}
        <Card className="mt-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start">
              <Shield className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
              <div>
                <span className="font-medium text-blue-900">Enterprise Security</span>
                <p className="text-sm text-blue-700 mt-1">
                  Your data is encrypted and secure. We comply with SOC 2, GDPR, and other enterprise security standards.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}