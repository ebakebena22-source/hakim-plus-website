import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, useSearchParams } from "react-router-dom";
import LandingPage from "./App";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import PortalLayout from "./layouts/PortalLayout";
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage, SocialAuthCompletePage, VerifyEmailPage } from "./pages/AuthPages";
import { PrivacyPolicyPage, TermsOfUsePage } from "./pages/LegalPages";
import { DashboardPage, HelpPage, NotFoundPage, OnboardingPage, ProfilePage } from "./pages/PortalPages";
import { BeneficiariesPage, BeneficiaryDetailPage, BeneficiaryFormPage } from "./pages/BeneficiaryPages";
import RequestWizardPage from "./pages/RequestWizardPage";
import { RequestConfirmationPage, RequestDetailPage, RequestsPage } from "./pages/RequestPages";
import StaffRoute from "./auth/StaffRoute";

const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AdminRequestsPage = lazy(() => import("./pages/AdminRequestPages").then((module) => ({ default: module.AdminRequestsPage })));
const AdminRequestDetailPage = lazy(() => import("./pages/AdminRequestPages").then((module) => ({ default: module.AdminRequestDetailPage })));
const AdminQuotePage = lazy(() => import("./pages/AdminQuotePage"));
const CustomerQuotePage = lazy(() => import("./pages/CustomerQuotePage"));
const PaymentCheckoutPage = lazy(() => import("./pages/PaymentPages").then((module) => ({ default: module.PaymentCheckoutPage })));
const PaymentsPage = lazy(() => import("./pages/PaymentPages").then((module) => ({ default: module.PaymentsPage })));
const ReceiptPage = lazy(() => import("./pages/PaymentPages").then((module) => ({ default: module.ReceiptPage })));
const OrdersPage = lazy(() => import("./pages/OrderPages").then((module) => ({ default: module.OrdersPage })));
const OrderDetailPage = lazy(() => import("./pages/OrderPages").then((module) => ({ default: module.OrderDetailPage })));
const AdminOrdersPage = lazy(() => import("./pages/AdminOrderPages").then((module) => ({ default: module.AdminOrdersPage })));
const AdminOrderDetailPage = lazy(() => import("./pages/AdminOrderPages").then((module) => ({ default: module.AdminOrderDetailPage })));
const NotificationsPage = lazy(() => import("./pages/NotificationPages").then((module) => ({ default: module.NotificationsPage })));
const CommunicationPreferencesPage = lazy(() => import("./pages/NotificationPages").then((module) => ({ default: module.CommunicationPreferencesPage })));
const MessageThreadPage = lazy(() => import("./pages/MessageThreadPage"));
const AccountActivityPage = lazy(() => import("./pages/AccountActivityPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/AdminAnalyticsPage"));
const AuditLogPage = lazy(() => import("./pages/AdminGovernancePages").then((module) => ({ default: module.AuditLogPage })));
const SecurityOverviewPage = lazy(() => import("./pages/AdminGovernancePages").then((module) => ({ default: module.SecurityOverviewPage })));
const AdminTransfersPage = lazy(() => import("./pages/AdminTransfersPage"));

function RouteLoading() {
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-5" role="status"><p className="text-sm font-semibold text-slate-600">Loading secure workspace…</p></main>;
}

function LandingOrSocialComplete() {
  const [searchParams] = useSearchParams();
  return searchParams.has("neon_auth_session_verifier") ? <SocialAuthCompletePage /> : <LandingPage />;
}

export default function SiteRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteLoading />}><Routes>
          <Route path="/" element={<LandingOrSocialComplete />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/social-complete" element={<SocialAuthCompletePage />} />
          <Route path="/terms" element={<TermsOfUsePage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><PortalLayout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="requests/new" element={<RequestWizardPage />} />
            <Route path="requests/:id" element={<RequestDetailPage />} />
            <Route path="requests/:id/confirmation" element={<RequestConfirmationPage />} />
            <Route path="requests/:id/quote" element={<CustomerQuotePage />} />
            <Route path="requests/:id/payment" element={<PaymentCheckoutPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="payments/:paymentId/receipt" element={<ReceiptPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile/communication" element={<CommunicationPreferencesPage />} />
            <Route path="requests/:id/messages" element={<MessageThreadPage />} />
            <Route path="beneficiaries" element={<BeneficiariesPage />} />
            <Route path="beneficiaries/new" element={<BeneficiaryFormPage />} />
            <Route path="beneficiaries/:id" element={<BeneficiaryDetailPage />} />
            <Route path="beneficiaries/:id/edit" element={<BeneficiaryFormPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/activity" element={<AccountActivityPage />} />
            <Route path="help" element={<HelpPage />} />
          </Route>
          <Route path="/admin" element={<StaffRoute><AdminLayout /></StaffRoute>}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="requests" element={<StaffRoute allowedRoles={["admin", "pharmacist", "customer_support"]}><AdminRequestsPage /></StaffRoute>} />
            <Route path="requests/:id" element={<StaffRoute allowedRoles={["admin", "pharmacist", "customer_support"]}><AdminRequestDetailPage /></StaffRoute>} />
            <Route path="requests/:id/quote" element={<StaffRoute allowedRoles={["admin", "pharmacist"]}><AdminQuotePage /></StaffRoute>} />
            <Route path="orders" element={<StaffRoute allowedRoles={["admin", "pharmacist", "fulfillment", "delivery_operations"]}><AdminOrdersPage /></StaffRoute>} />
            <Route path="orders/:id" element={<StaffRoute allowedRoles={["admin", "pharmacist", "fulfillment", "delivery_operations"]}><AdminOrderDetailPage /></StaffRoute>} />
            <Route path="bank-transfers" element={<StaffRoute allowedRoles={["admin", "pharmacist"]}><AdminTransfersPage /></StaffRoute>} />
            <Route path="analytics" element={<StaffRoute allowedRoles={["admin"]}><AdminAnalyticsPage /></StaffRoute>} />
            <Route path="audit-logs" element={<StaffRoute allowedRoles={["admin"]}><AuditLogPage /></StaffRoute>} />
            <Route path="security" element={<StaffRoute allowedRoles={["admin"]}><SecurityOverviewPage /></StaffRoute>} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes></Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
