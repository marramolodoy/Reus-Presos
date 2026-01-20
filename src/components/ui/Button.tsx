import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'outline-danger' | 'outline-primary';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    leftIcon?: React.ElementType;
    rightIcon?: React.ElementType;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    className = '',
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    disabled,
    ...props
}) => {
    const baseStyles = "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-lg";

    const variants = {
        primary: "bg-justice-700 text-white hover:bg-justice-800 focus:ring-justice-500 shadow-sm",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500",
        danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm",
        ghost: "bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        outline: "border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50",
        'outline-danger': "border border-red-200 text-red-600 bg-white hover:bg-red-50 hover:border-red-300",
        'outline-primary': "border border-justice-200 text-justice-700 bg-white hover:bg-justice-50 hover:border-justice-300",
    };

    const sizes = {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 py-2 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-9 w-9 p-0",
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!isLoading && LeftIcon && <LeftIcon className={`h-4 w-4 ${children ? 'mr-2' : ''}`} />}
            {children}
            {!isLoading && RightIcon && <RightIcon className={`h-4 w-4 ${children ? 'ml-2' : ''}`} />}
        </button>
    );
};
