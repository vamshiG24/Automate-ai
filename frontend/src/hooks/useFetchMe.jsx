import { fetchMeApi } from "@/features/auth";
import { clearUser, setUser } from "@/redux/userSlice";
import { useEffect } from "react";
import { useDispatch } from "react-redux";




export default function useFetchMe() {
  const dispatch = useDispatch();

  useEffect(() => {
    const fetchUser = async () => {
    

      try {
        const user = await fetchMeApi();
        dispatch(setUser(user));
      } catch (error) {
         dispatch(clearUser());
      }
    };

    fetchUser();
  }, [dispatch]);
}