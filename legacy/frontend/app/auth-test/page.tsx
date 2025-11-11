"use client";

import { useState } from "react";
import { SmsLogin } from "@/components/SmsLogin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface IUser {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
}

export default function AuthTestPage() {
  const [currentUser, setCurrentUser] = useState<IUser | null>(null);
  const { toast } = useToast();

  const handleSMSSuccess = (user: IUser) => {
    setCurrentUser(user);
    toast({
      title: "SMS Login Successful",
      description: `Welcome, ${user.name || user.phone}!`,
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully.",
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>TuneTrees Authentication Test</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Test the SMS authentication functionality. In development mode,
              verification codes are logged to the backend console.
            </p>

            {currentUser ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">
                  Logged in successfully!
                </h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <strong>ID:</strong> {currentUser.id}
                  </p>
                  <p>
                    <strong>Name:</strong> {currentUser.name || "Not provided"}
                  </p>
                  <p>
                    <strong>Email:</strong>{" "}
                    {currentUser.email || "Not provided"}
                  </p>
                  <p>
                    <strong>Phone:</strong>{" "}
                    {currentUser.phone || "Not provided"}
                  </p>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="mt-3"
                >
                  Logout
                </Button>
              </div>
            ) : (
              <div className="grid md:grid-cols-1 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    SMS Authentication
                  </h3>
                  <SmsLogin onSuccess={handleSMSSuccess} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuration Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold">SMS/Twilio Setup:</h4>
              <p className="text-sm text-gray-600">
                For production SMS functionality, set these environment
                variables:
              </p>
              <ul className="text-sm text-gray-600 list-disc list-inside mt-2 space-y-1">
                <li>
                  <code>TWILIO_ACCOUNT_SID</code> - Your Twilio Account SID
                </li>
                <li>
                  <code>TWILIO_AUTH_TOKEN</code> - Your Twilio Auth Token
                </li>
                <li>
                  <code>TWILIO_PHONE_NUMBER</code> - Your Twilio phone number
                </li>
                <li>
                  <code>NODE_ENV=production</code> - To enable actual SMS
                  sending
                </li>
              </ul>
              <p className="text-sm text-gray-600 mt-2">
                In development mode, verification codes are logged to the
                backend console instead of being sent via SMS.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
