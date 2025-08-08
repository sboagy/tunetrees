"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SMSVerificationOption } from "./sms-verification-option";
import { Mail, Phone } from "lucide-react";

interface IVerificationMethodSelectorProps {
  title: string;
  description: string;
  emailButtonText: string;
  smsButtonText?: string;
  smsDescription?: string;
  onEmailMethod: () => void;
  onSMSVerified: (phone: string) => void;
  onError?: (error: string) => void;
  emailDisabled?: boolean;
  smsDisabled?: boolean;
  showSMS?: boolean;
}

export function VerificationMethodSelector({
  title,
  description,
  emailButtonText,
  smsButtonText = "Verify via SMS",
  smsDescription = "Enter your phone number to receive a verification code",
  onEmailMethod,
  onSMSVerified,
  onError,
  emailDisabled = false,
  smsDisabled = false,
  showSMS = true,
}: IVerificationMethodSelectorProps) {
  const [activeTab, setActiveTab] = useState("email");

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl text-center">{title}</CardTitle>
        <p className="text-sm text-muted-foreground text-center">
          {description}
        </p>
      </CardHeader>
      <CardContent>
        {showSMS ? (
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="sms" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                SMS
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  We'll send you a verification link via email
                </p>
                <Button
                  onClick={onEmailMethod}
                  disabled={emailDisabled}
                  className="w-full"
                  data-testid="email-verification-button"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {emailButtonText}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="sms" className="space-y-4">
              <SMSVerificationOption
                onVerificationSuccess={onSMSVerified}
                onError={onError}
                buttonText={smsButtonText}
                description={smsDescription}
                disabled={smsDisabled}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              We'll send you a verification link via email
            </p>
            <Button
              onClick={onEmailMethod}
              disabled={emailDisabled}
              className="w-full"
              data-testid="email-verification-button"
            >
              <Mail className="mr-2 h-4 w-4" />
              {emailButtonText}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
