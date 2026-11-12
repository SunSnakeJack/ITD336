import type { ReactNode } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { LoginForm } from "./features/auth/components/LoginForm";
import { normalizeAuthReturnTo } from "./features/auth/auth.service";
import { useAuthSession } from "./features/auth/hooks/useAuthSession";
import type { AuthIdentity } from "./features/auth/auth.types";
import { AdminLayout } from "./features/admin/components/AdminLayout";
import { AdminDashboardPage } from "./features/admin/pages/AdminDashboardPage";
import { AcademicSchedulesPage } from "./features/admin/pages/AcademicSchedulesPage";
import { AdminRoomSchedulePage } from "./features/admin/pages/AdminRoomSchedulePage";
import { RoomsManagementPage } from "./features/admin/pages/RoomsManagementPage";
import { AdminRoomDetailPage } from "./features/admin/pages/AdminRoomDetailPage";
import { AcademicTermsPage } from "./features/admin/pages/AcademicTermsPage";
import { AdminPlaceholderPage } from "./features/admin/pages/AdminPlaceholderPage";
import { PublicLayout } from "./features/public/components/PublicLayout";
import { RoomSelectionPage } from "./features/student/pages/RoomSelectionPage";
import { RoomDetailPage } from "./features/student/pages/RoomDetailPage";
import { AdminBookingsPage } from "./features/admin/pages/AdminBookingsPage";
import { AccountRequestsPage } from "./features/bookings/pages/AccountRequestsPage";
import { LoadingSpinner } from "./shared/components/LoadingSpinner";
import { useRealtimeInvalidation } from "./shared/hooks/useRealtimeInvalidation";
import { UsagePolicyPage } from "./features/policies/pages/UsagePolicyPage";
import { AdminKeyCabinetPage } from "./features/keys/pages/AdminKeyCabinetPage";
import { KeyRequestRoomsPage } from "./features/keys/pages/KeyRequestRoomsPage";
import { KeyRequestFormPage } from "./features/keys/pages/KeyRequestFormPage";
import { KeyRequestRoomDetailPage } from "./features/keys/pages/KeyRequestRoomDetailPage";
import { AccountProfilePage } from "./features/public/pages/AccountProfilePage";
import { AccountKeyRequestHistoryPage } from "./features/keys/pages/AccountKeyRequestHistoryPage";
import { KeyRequestActionPage } from "./features/keys/pages/KeyRequestActionPage";
import { MeetingRoomDetailPage, MeetingRoomEntryPage } from "./features/meeting-rooms/pages/MeetingRoomDetailPage";
import { MeetingRoomRequestPage } from "./features/meeting-rooms/pages/MeetingRoomRequestPage";
import { StaffLayout } from "./features/staff/components/StaffLayout";
import { StaffHomePage, StaffRoomDetailPage, StaffRoomsPage, StaffSettingsPage } from "./features/staff/pages/StaffOverviewPages";
import { StaffKeyRequestDetailPage, StaffKeyRequestsPage, StaffMeetingRoomFormPage, StaffMeetingRoomsPage, StaffUserFormPage, StaffUsersPage } from "./features/staff/pages/StaffManagementPages";
import { StaffLabHistoryPage, StaffMeetingHistoryPage } from "./features/staff/pages/StaffHistoryPages";
import { StaffLabDashboardPage, StaffMeetingDashboardPage } from "./features/staff/pages/StaffDashboardPages";
import { StaffLabReportPage, StaffMeetingReportPage } from "./features/staff/pages/StaffReportPages";

function AdminGuard({
  identity,
  loading,
  children,
}: {
  identity: AuthIdentity | null;
  loading: boolean;
  children: ReactNode;
}) {
  if (loading)
    return (
      <main className="session-loading">
        <LoadingSpinner label="กำลังตรวจสอบสิทธิ์…" />
      </main>
    );
  return identity?.role === "ADMIN" ? (
    children
  ) : (
    <Navigate to="/login" replace />
  );
}

function AccountGuard({
  identity,
  loading,
  children,
}: {
  identity: AuthIdentity | null;
  loading: boolean;
  children: ReactNode;
}) {
  if (loading)
    return (
      <main className="session-loading">
        <LoadingSpinner label="กำลังตรวจสอบบัญชี…" />
      </main>
    );
  return identity ? children : <Navigate to="/login" replace />;
}

function LegacyRoomRedirect() {
  const { roomId } = useParams();
  return <Navigate to={roomId ? `/rooms/${roomId}` : "/"} replace />;
}

function LoginRoute({
  identity,
  loading,
  error,
}: {
  identity: AuthIdentity | null;
  loading: boolean;
  error: string | null;
}) {
  const location = useLocation();
  const requested = new URLSearchParams(location.search).get("returnTo");
  const returnTo = normalizeAuthReturnTo(requested);
  if (loading)
    return (
      <main className="session-loading">
        <LoadingSpinner label="กำลังตรวจสอบบัญชี…" />
      </main>
    );
  if (identity)
    return (
      <Navigate to={identity.role === "ADMIN" ? "/admin" : returnTo} replace />
    );
  return (
    <>
      {error && (
        <div className="session-message" role="status">
          {error}
        </div>
      )}
      <LoginForm returnTo={returnTo} />
    </>
  );
}

export function App() {
  const { identity, loading, error, logout } = useAuthSession();
  useRealtimeInvalidation(Boolean(identity));
  return (
    <Routes>
      <Route
        element={
          <PublicLayout
            identity={identity}
            loading={loading}
            onLogout={logout}
          />
        }
      >
        <Route index element={<RoomSelectionPage />} />
        <Route path="keys" element={<KeyRequestRoomsPage identity={identity} />} />
        <Route path="meeting-room" element={<MeetingRoomEntryPage />} />
        <Route path="meeting-room/:roomId" element={<MeetingRoomDetailPage identity={identity} />} />
        <Route path="meeting-room/:roomId/request" element={<MeetingRoomRequestPage identity={identity} authLoading={loading} />} />
        <Route path="key-request-action" element={<KeyRequestActionPage />} />
        <Route
          path="keys/rooms/:roomId"
          element={<KeyRequestRoomDetailPage identity={identity} />}
        />
        <Route
          path="keys/rooms/:roomId/request"
          element={
            <KeyRequestFormPage identity={identity} authLoading={loading} />
          }
        />
        <Route path="rooms" element={<Navigate to="/" replace />} />
        <Route
          path="rooms/:roomId"
          element={<RoomDetailPage identity={identity} />}
        />
        <Route path="account" element={<Navigate to="/account/profile" replace />} />
        <Route path="account/profile" element={<AccountGuard identity={identity} loading={loading}>{identity&&<AccountProfilePage identity={identity}/>}</AccountGuard>} />
        <Route
          path="account/requests"
          element={
            <AccountGuard identity={identity} loading={loading}>
              <AccountRequestsPage />
            </AccountGuard>
          }
        />
        <Route
          path="account/bookings"
          element={<Navigate to="/account/requests" replace />}
        />
        <Route
          path="account/keys"
          element={<Navigate to="/account/requests" replace />}
        />
        <Route
          path="account/history"
          element={
            <AccountGuard identity={identity} loading={loading}>
              <AccountKeyRequestHistoryPage />
            </AccountGuard>
          }
        />
      </Route>
      <Route
        path="login"
        element={
          <LoginRoute identity={identity} loading={loading} error={error} />
        }
      />
      <Route
        path="admin"
        element={
          <AdminGuard identity={identity} loading={loading}>
            <AdminLayout
              identity={identity as AuthIdentity}
              onLogout={logout}
            />
          </AdminGuard>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="rooms" element={<RoomsManagementPage />} />
        <Route path="rooms/:roomId" element={<AdminRoomDetailPage />} />
        <Route path="terms" element={<AcademicTermsPage />} />
        <Route path="academic-schedules" element={<AcademicSchedulesPage />} />
        <Route path="room-schedule" element={<AdminRoomSchedulePage />} />
        <Route
          path="users"
          element={<AdminPlaceholderPage title="จัดการผู้ใช้งาน" />}
        />
        <Route path="bookings" element={<AdminBookingsPage />} />
        <Route path="keys" element={<AdminKeyCabinetPage />} />
        <Route path="policies" element={<UsagePolicyPage />} />
      </Route>
      <Route
        path="staff"
        element={
          <AdminGuard identity={identity} loading={loading}>
            <StaffLayout identity={identity as AuthIdentity} onLogout={logout} />
          </AdminGuard>
        }
      >
        <Route index element={<StaffHomePage />} />
        <Route path="rooms" element={<StaffRoomsPage />} />
        <Route path="rooms/:roomId" element={<StaffRoomDetailPage />} />
        <Route path="settings" element={<StaffSettingsPage />} />
        <Route path="users" element={<StaffUsersPage />} />
        <Route path="users/new" element={<StaffUserFormPage />} />
        <Route path="users/:userId/edit" element={<StaffUserFormPage />} />
        <Route path="key-requests" element={<StaffKeyRequestsPage />} />
        <Route path="key-requests/:requestId" element={<StaffKeyRequestDetailPage />} />
        <Route path="meeting-rooms" element={<StaffMeetingRoomsPage />} />
        <Route path="meeting-rooms/new" element={<StaffMeetingRoomFormPage />} />
        <Route path="meeting-rooms/:roomId/edit" element={<StaffMeetingRoomFormPage />} />
        <Route path="history/labs" element={<StaffLabHistoryPage />} />
        <Route path="history/meetings" element={<StaffMeetingHistoryPage />} />
        <Route path="dashboard/labs" element={<StaffLabDashboardPage />} />
        <Route path="dashboard/meetings" element={<StaffMeetingDashboardPage />} />
        <Route path="reports/labs" element={<StaffLabReportPage />} />
        <Route path="reports/meetings" element={<StaffMeetingReportPage />} />
      </Route>
      <Route path="student/rooms" element={<Navigate to="/" replace />} />
      <Route path="student/rooms/:roomId" element={<LegacyRoomRedirect />} />
      <Route path="student/schedule" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
