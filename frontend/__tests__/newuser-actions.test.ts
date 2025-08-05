/**
 * Unit tests for newUser action function
 * Tests the signup logic for handling existing verified/unverified users
 */
/* eslint-disable @typescript-eslint/unbound-method */
import type { AccountFormValues } from "@/app/auth/newuser/account-form";
import { newUser } from "@/app/auth/newuser/newuser-actions";
import {
  type IExtendedAdapterUser,
  getUserExtendedByEmail,
  ttHttpAdapter,
} from "@/auth/auth-tt-adapter";
import { sendGrid } from "@/auth/helpers";
import type { AdapterUser } from "next-auth/adapters";

// Mock all dependencies
jest.mock("@/auth/auth-tt-adapter", () => ({
  getUserExtendedByEmail: jest.fn(),
  ttHttpAdapter: {
    createUser: jest.fn(),
    deleteUser: jest.fn(),
    createVerificationToken: jest.fn(),
  },
}));

jest.mock("@/auth/helpers", () => ({
  sendGrid: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
  hashSync: jest.fn().mockReturnValue("mocked-hashed-password"),
  genSaltSync: jest.fn().mockReturnValue("mocked-salt"),
}));

// Mock verification mail functions
jest.mock("@/auth/auth-send-request", () => ({
  verification_mail_html: jest.fn().mockReturnValue("<html>Mock HTML</html>"),
  verification_mail_text: jest.fn().mockReturnValue("Mock text email"),
}));

// Mock fetch for SMS verification
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({ success: true }),
});

describe("newUser function - Bug #3 fix", () => {
  const mockFormData: AccountFormValues = {
    csrfToken: "mock-csrf-token",
    name: "Test User",
    email: "test@example.com",
    password: "TestPassword123!",
    password_confirmation: "TestPassword123!",
    phone: "+1234567890",
  };

  const mockHost = "localhost:3000";

  const mockExistingVerifiedUser: IExtendedAdapterUser = {
    id: "user-123",
    name: "Existing User",
    email: "test@example.com",
    emailVerified: new Date("2024-01-01T10:00:00Z"), // Verified user
    hash: "existing-hash",
  };

  const mockExistingUnverifiedUser: IExtendedAdapterUser = {
    id: "user-456",
    name: "Unverified User",
    email: "test@example.com",
    emailVerified: null, // Unverified user
    hash: "existing-hash",
  };

  const mockCreatedUser: AdapterUser = {
    id: "user-789",
    name: "Test User",
    email: "test@example.com",
    emailVerified: null,
  };

  const mockVerificationToken = {
    identifier: "test@example.com",
    expires: new Date(Date.now() + 2 * 60 * 60 * 1000),
    token: "123456",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock functions that might have been set to undefined in tests
    ttHttpAdapter.createUser = jest.fn();
    ttHttpAdapter.deleteUser = jest.fn();
    ttHttpAdapter.createVerificationToken = jest.fn();

    // Default mocks for successful flow
    (ttHttpAdapter.createUser as jest.Mock).mockResolvedValue(mockCreatedUser);
    (ttHttpAdapter.createVerificationToken as jest.Mock).mockResolvedValue(
      mockVerificationToken,
    );
    (sendGrid as jest.Mock).mockResolvedValue({ success: true });
  });

  describe("Bug #3: Block in signup should only occur with verified password", () => {
    it("should throw error when user exists and is verified", async () => {
      // Arrange: Mock existing verified user
      (getUserExtendedByEmail as jest.Mock).mockResolvedValue(
        mockExistingVerifiedUser,
      );

      // Act & Assert: Should throw error for verified user
      await expect(newUser(mockFormData, mockHost)).rejects.toThrow(
        "User already exists for test@example.com. If this is your account, please use the sign-in page or reset your password.",
      );

      // Verify: Should not attempt to delete verified user
      expect(ttHttpAdapter.deleteUser).not.toHaveBeenCalled();
      expect(ttHttpAdapter.createUser).not.toHaveBeenCalled();
    });

    it("should allow signup by deleting unverified user", async () => {
      // Arrange: Mock existing unverified user
      (getUserExtendedByEmail as jest.Mock).mockResolvedValue(
        mockExistingUnverifiedUser,
      );
      (ttHttpAdapter.deleteUser as jest.Mock).mockResolvedValue(undefined);

      // Act: Attempt signup with unverified existing user
      const result = await newUser(mockFormData, mockHost);

      // Assert: Should successfully complete signup
      expect(result.status).toBe(
        "User created successfully. Verification email sent to test@example.com. SMS verification sent to +1234567890.",
      );
      expect(result.linkBackURL).toContain("test@example.com");
      expect(result.linkBackURL).toContain("123456");

      // Verify: Should delete unverified user first
      expect(ttHttpAdapter.deleteUser).toHaveBeenCalledWith("user-456");
      expect(ttHttpAdapter.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test User",
          email: "test@example.com",
          phone: "+1234567890",
          hash: "mocked-hashed-password",
        }),
      );
    });

    it("should handle delete failure gracefully", async () => {
      // Arrange: Mock existing unverified user with delete failure
      (getUserExtendedByEmail as jest.Mock).mockResolvedValue(
        mockExistingUnverifiedUser,
      );
      (ttHttpAdapter.deleteUser as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      // Act & Assert: Should throw error when delete fails
      await expect(newUser(mockFormData, mockHost)).rejects.toThrow(
        "Unable to complete signup. Please contact support if this issue persists.",
      );

      // Verify: Should attempt to delete but not create new user
      expect(ttHttpAdapter.deleteUser).toHaveBeenCalledWith("user-456");
      expect(ttHttpAdapter.createUser).not.toHaveBeenCalled();
    });

    it("should handle case where deleteUser function is undefined", async () => {
      // Arrange: Mock existing unverified user with undefined deleteUser
      (getUserExtendedByEmail as jest.Mock).mockResolvedValue(
        mockExistingUnverifiedUser,
      );
      (ttHttpAdapter.deleteUser as unknown) = undefined;

      // Act & Assert: Should throw error when deleteUser is undefined
      await expect(newUser(mockFormData, mockHost)).rejects.toThrow(
        "ttHttpAdapter.deleteUser is not defined.",
      );

      // Verify: Should not attempt to create new user
      expect(ttHttpAdapter.createUser).not.toHaveBeenCalled();
    });

    it("should proceed normally when no existing user found", async () => {
      // Arrange: Mock no existing user
      (getUserExtendedByEmail as jest.Mock).mockResolvedValue(null);

      // Act: Attempt signup with no existing user
      const result = await newUser(mockFormData, mockHost);

      // Assert: Should successfully complete signup
      expect(result.status).toBe(
        "User created successfully. Verification email sent to test@example.com. SMS verification sent to +1234567890.",
      );
      expect(result.linkBackURL).toContain("test@example.com");

      // Verify: Should not attempt to delete any user
      expect(ttHttpAdapter.deleteUser).not.toHaveBeenCalled();
      expect(ttHttpAdapter.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test User",
          email: "test@example.com",
          phone: "+1234567890",
          hash: "mocked-hashed-password",
        }),
      );
    });
  });

  describe("Edge cases and error handling", () => {
    it("should throw error when email is empty", async () => {
      // Arrange: Mock form data with empty email
      const invalidFormData = { ...mockFormData, email: "" };

      // Act & Assert: Should throw error for empty email
      await expect(newUser(invalidFormData, mockHost)).rejects.toThrow(
        "Empty Email.",
      );

      // Verify: Should not check for existing users
      expect(getUserExtendedByEmail).not.toHaveBeenCalled();
    });

    it("should throw error when createUser is undefined", async () => {
      // Arrange: Mock no existing user but undefined createUser
      (getUserExtendedByEmail as jest.Mock).mockResolvedValue(null);
      (ttHttpAdapter.createUser as unknown) = undefined;

      // Act & Assert: Should throw error when createUser is undefined
      await expect(newUser(mockFormData, mockHost)).rejects.toThrow(
        "ttHttpAdapter.createUser is not defined.",
      );
    });
  });
});
