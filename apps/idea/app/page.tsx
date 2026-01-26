import Image from "next/image";

export default function Home() {
  return (
   <div className="flex flex-col items-center min-h-screen">
    <div className="w-full h-[44px] bg-gray-100 flex items-center justify-around font-serif">
        {Array.from({ length: 26 }).map((_, i) => (
          <div key={i} className="w-14 h-14 flex items-center justify-center">
            <span className="text-gray-400">{String.fromCharCode(65 + i)}</span>
          </div>
        ))}
      </div>
      <div className="w-full h-[calc(100vh-88px)] flex flex-col items-center justify-center gap-6 relative">
      <div className="w-full  max-w-3xl h-[300px] relative border border-gray-200 rounded-xl font-display text-9xl flex items-center justify-center">
        <span>Anglish Wiki</span>
        <div className="w-20 h-20 bg-green-400 rounded absolute top-8 -right-10" />
        <div className="w-16 h-30 bg-green-400 rounded absolute bottom-8 -left-10" />
      </div>
           {/* Search Bar */}
     <input type="text" className="w-full max-w-3xl h-14 border rounded-xl p-2 placeholder:text-gray-400 font-serif focus:outline-none" placeholder="Search for a word..." />
     <div className="text-sm text-gray-400 w-full text-right p-4 absolute bottom-0 right-0 font-serif">
      Art by <a  href="https://dagmarsmithart.com" target="_blank" className="underline text-gray-600">Dagmar Smith</a>
      </div>
     </div>

     

     <div className="h-[44px] bg-gray-700 sticky top-0 text-white w-full flex items-center justify-center gap-20 font-serif">
    <span>Home</span>
     <span>About</span>
    <span>Contact</span>
    <span>Login</span>
    <span>Register</span>
    </div>
    <div className="w-full h-[800px]  flex flex-col items-center gap-6 max-w-3xl p-6">
      <div className="font-serif">
      <h1 className="text-6xl">About</h1>
      <p className="text-2xl">Anglish is a language that is a mix of English and Latin. It is a language that is used to communicate with other people who speak English and Latin.</p>
      </div>
    </div>
    <div className="w-full h-[800px] bg-gray-200 flex items-center justify-center ">
      <h1>Other</h1>
    </div>
   </div> 
  
  );
}
