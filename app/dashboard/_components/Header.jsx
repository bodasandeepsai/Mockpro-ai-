"use client"
import React, { useEffect } from 'react'
import Image from 'next/image'
import { UserButton } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'

const Header = () => {

    const path = usePathname();
    useEffect(()=>{

    },[])

  return (
    <div className='flex p-2 items-center justify-between bg-secondary shadow-sm'>
      <Image  src={'/logo.svg'} width={80} height={20} alt='logo' />
      <ul className='hidden md:flex gap-6'>
        <li className={`hover:text-primary hover:font-bold transition-all cursor-pointer ${path=='/dashboard'&&'text-primary font-bold'}`}>Dashboard</li>
        <li className={`hover:text-primary hover:font-bold transition-all cursor-pointer ${path=='/How it works'&&'text-primary font-bold'}`}>How it works?</li>
        <li className={`hover:text-primary hover:font-bold transition-all cursor-pointer ${path=='/Upgrade'&&'text-primary font-bold'}`}>Upgrade</li>
      </ul>
        <UserButton/>
    </div>
  )
}

export default Header
