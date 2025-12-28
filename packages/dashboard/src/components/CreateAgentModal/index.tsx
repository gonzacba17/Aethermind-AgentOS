'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { Step1BasicInfo } from './Step1BasicInfo';
import { Step2ModelConfig } from './Step2ModelConfig';
import { Step3SystemPrompt } from './Step3SystemPrompt';
import { Step4Review } from './Step4Review';
import { WIZARD_STEPS, type AgentFormData } from './types';
import type { Agent } from '@/lib/api';

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (agent: Agent) => void;
  existingAgents?: Agent[];
  onCreateAgent: (data: Partial<AgentFormData>) => Promise<Agent>;
}

const initialFormData: AgentFormData = {
  name: '',
  description: '',
  tags: [],
  provider: 'openai',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: undefined,
  systemPrompt: '',
};

export function CreateAgentModal({
  isOpen,
  onClose,
  onSuccess,
  existingAgents = [],
  onCreateAgent,
}: CreateAgentModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<AgentFormData>(initialFormData);
  const [isCreating, setIsCreating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setFormData(initialFormData);
      setHasChanges(false);
    }
  }, [isOpen]);

  const updateFormData = (data: Partial<AgentFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setHasChanges(true);
  };

  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return (
          formData.name.length >= 3 &&
          /^[a-z0-9-]+$/i.test(formData.name) &&
          !existingAgents.some((a) => a.name.toLowerCase() === formData.name.toLowerCase())
        );
      case 2:
        return formData.provider && formData.model;
      case 3:
        return formData.systemPrompt.trim().length > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const agent = await onCreateAgent({
        name: formData.name,
        model: formData.model,
        systemPrompt: formData.systemPrompt,
        // Note: Current API might not support all fields, so we only send what's needed
      });
      onSuccess(agent);
      onClose();
    } catch (error) {
      console.error('Failed to create agent:', error);
      alert('Failed to create agent. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const renderStep = () => {
    const existingNames = existingAgents.map((a) => a.name.toLowerCase());

    switch (currentStep) {
      case 1:
        return (
          <Step1BasicInfo
            formData={formData}
            updateFormData={updateFormData}
            existingAgentNames={existingNames}
          />
        );
      case 2:
        return <Step2ModelConfig formData={formData} updateFormData={updateFormData} />;
      case 3:
        return <Step3SystemPrompt formData={formData} updateFormData={updateFormData} />;
      case 4:
        return <Step4Review formData={formData} onEdit={setCurrentStep} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Agent</DialogTitle>
          <DialogDescription>
            Set up a new AI agent with custom configuration
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-6">
          {WIZARD_STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    currentStep > step.id
                      ? 'bg-green-600 text-white'
                      : currentStep === step.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <div className="text-xs text-center mt-1 font-medium">{step.title}</div>
              </div>
              {index < WIZARD_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    currentStep > step.id ? 'bg-green-600' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="py-4">{renderStep()}</div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            type="button"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleClose} type="button">
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>

            {currentStep < WIZARD_STEPS.length ? (
              <Button onClick={handleNext} disabled={!canProceed()} type="button">
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={isCreating || !canProceed()} type="button">
                {isCreating ? (
                  <>Creating...</>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Create Agent
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
