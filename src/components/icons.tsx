import { cn } from "@/lib/utils";

export const Icon = {
  Discord: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 16.5334 18.9554 20.2464 14.9999 21.5" />
      <path d="M9 10H9.01" />
      <path d="M15 10H15.01" />
      <path d="M9.5 15.5C9.5 15.5 10.5 17.5 12 17.5C13.5 17.5 14.5 15.5 14.5 15.5" />
    </svg>
  ),
  Logo: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-6 w-6", className)}
      {...props}
    >
      <path d="M12 2l-2 4h4l-2 -4z" />
      <path d="M12 22l-2 -4h4l-2 4z" />
      <path d="M22 12l-4 -2v4l4 -2z" />
      <path d="M2 12l4 -2v4l-4 -2z" />
      <path d="M16.25 7.75l-8.5 8.5" />
      <path d="M7.75 7.75l8.5 8.5" />
    </svg>
  ),
};
